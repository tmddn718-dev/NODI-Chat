# 분석 이벤트 사전 (Amplitude)

구현: `src/analytics.ts`(SDK·허용 목록·동의 연동), `src/flow.ts`(퍼널 시점·중복 방지), `src/consent.ts`(동의·익명 ID). 이벤트 이름과 속성은 `EventMap`/`EVENT_PROPERTIES` 한 곳에 타입으로 정의돼 있어서, 사전에 없는 이름·속성은 **컴파일이 안 되고**, 실행 중에도 버려져요.

## 원칙
- **동의한 사용자의 명시적 이벤트만** 보내요. 자동 수집(페이지뷰·폼·파일 다운로드·클릭·유입 속성)은 모두 **꺼져 있어요**. Session Replay 패키지는 설치하지 않았어요. `userId`·`identify`는 쓰지 않아요.
- **동의 전에는 SDK를 내려받지도, 초기화하지도 않아요**(요청 0건). 철회하면 `setOptOut(true)`, 아직 안 나간 이벤트는 버려요.
- 속성 값은 숫자·불리언·짧은 코드형 문자열(`[a-z0-9_.+-]{1,48}`)만 허용돼요. 이름·문장이 실수로 섞여도 버려져요(`sanitize`, 테스트로 검증).
- API Key가 없거나, 동의하지 않았거나, 개발 빌드(`VITE_ANALYTICS_IN_DEV` 없이)면 아무것도 안 보내요. SDK 초기화가 실패해도 앱은 계속 동작해요.

## 공통 속성(모든 이벤트에 자동으로 붙음)
| 속성 | 값 |
|---|---|
| `anonymous_session_id` | 동의 후 만든 무작위 UUID(철회하면 삭제) |
| `environment` | `development` / `staging` / `production` |
| `app_version`, `flow_version` | 빌드 버전, 흐름 버전 |
| `experiment_id`, `experiment_variant` | 실험 이름(없으면 `none`), `control` / `variant_a` / `variant_b` / `none` |
| `test_mode` | 항상 `fictional_calendar` |
| `device_category` | `mobile`(≤767) / `tablet`(768–1199) / `desktop`(≥1200) — CSS 기준과 같고, 세션 시작 때 한 번 정해 고정 |
| `viewport_bucket` | `small`(<480) / `medium`(480–1023) / `large`(≥1024) |
| `locale` | `ko` / `en` / `other` |
| `step_name` | `consent`·`conditions`·`participants`·`search`·`recommendations`·`confirm`·`feedback`·`done` |

## 이벤트 14개
| # | 이벤트 | 발생 시점(한 번씩) | 고유 속성 |
|---|---|---|---|
| 1 | `prototype_viewed` | 동의한 사용자가 화면을 열 때 | `entry_context`: direct/internal/external |
| 2 | `analytics_consent_accepted` | 동의했을 때 | `consent_policy_version` |
| 3 | `meeting_flow_started` | 첫 선택지 클릭 또는 첫 자유 입력 | `start_method`: choice/natural_language |
| 4 | `meeting_details_completed` | 제목·목적·시간이 모두 정해졌을 때 | `input_method`, `elapsed_ms`(흐름 시작 후) |
| 5 | `participants_configured` | 참석자와 필수/선택 구분이 정해졌을 때 | `participant_count_bucket`(1·2-3·4-10·11-30·31plus), `elapsed_ms` |
| 6 | `recommendations_requested` | 추천 요청을 제출할 때마다 | `request_index`(몇 번째 요청) |
| 7 | `recommendations_viewed` | 후보가 화면에 나타날 때 | `recommendation_count`, `elapsed_ms`(요청→표시) |
| 8 | `recommendation_selected` | 후보를 골라 확정 검토를 누를 때 | `recommendation_rank`, `is_first_recommendation` |
| 9 | `recommendation_regenerated` | 재탐색이 **성공했을 때** | `regeneration_count`, `reason_category`: refresh/conditions_changed/no_candidates |
| 10 | `meeting_confirmed` | 가상 회의 최종 확정 성공 | `total_elapsed_ms`, `regeneration_count` |
| 11 | `flow_abandoned` | 아래 이탈 규칙 | `last_completed_step`, `elapsed_ms`, `abandon_reason` |
| 12 | `prototype_error` | 경험에 영향을 준 오류(코드·단계당 1회) | `error_code`, `recoverable` |
| 13 | `feedback_opened` | 피드백 창을 열 때(1회) | `flow_completed` |
| 14 | `feedback_submitted` | 피드백이 **DB에 저장된 뒤** | `feedback_score`, `ease_score`, `feedback_tags` |

## 순서·중복 규칙
- 퍼널 순서는 `details → participants`로 고정돼요. 참석자가 먼저 정해져도 `participants_configured`는 회의 정보 완료 뒤에 나가요.
- run(회의 만들기 한 번)마다 같은 이벤트는 키로 한 번씩만 나가요. 화면 재렌더·React StrictMode로 두 번 나가지 않아요. 후보 세트가 같으면 `recommendations_viewed`도 한 번이에요.
- `recommendations_requested`는 사용자가 요청할 때마다 나가요(`request_index`로 구분). 요청이 실패하면 `prototype_error`가 따로 나가고 `recommendation_regenerated`는 나가지 않아요.
- `recoverable=false` 오류: `demo_disabled`, `ai_not_configured`, `ai_unavailable`, `not_found`, `origin_not_allowed`.

## 이탈 판정 규칙
- ① "새 대화"·테스트 초기화로 명시적으로 다시 시작하면 `restart`, ② 시작했지만 확정하지 않은 채 페이지가 닫히면(`pagehide`) `page_hidden`.
- ②는 **근사치**예요(탭을 닫았다가 같은 초안으로 돌아올 수 있어 실제 이탈보다 많게 잡힐 수 있어요). 한 run에서 이탈은 한 번, 확정한 run은 이탈이 아니에요.
- 초안을 복원해 이어서 한 경우 `meeting_flow_started`가 없는 run이 생길 수 있어요.

## 식별자 정리
| 식별자 | 누가 만드나 | 어디로 가나 |
|---|---|---|
| Amplitude Device ID | SDK(localStorage) | Amplitude 이벤트 |
| `anonymous_session_id` | 앱(동의 후 UUID) | Amplitude 이벤트 속성 |
| `run_id` | 앱(흐름마다) | **우리 서버 저장소에만** — Amplitude에는 안 보내요(분석 데이터와 자유 의견이 이어지지 않게) |

## 금지 데이터
이름·이메일·전화번호·회사명, 실제 캘린더 제목·참석자, **입력 문장 원문**, Groq 프롬프트·응답, API 키·토큰·쿠키 값, **피드백 자유 의견 원문**(서버 저장소에만).

## 새 이벤트·속성을 추가하려면
`EventMap`과 `EVENT_PROPERTIES`에 함께 추가 → 이 문서 표 갱신 → 테스트(`analytics.test.ts`의 사전 완전성 검사) 통과.

## 서버로 가는 "흐름 요약"(분석 이벤트 아님)
동의한 사용자가 확정하거나 이탈하면 `POST /api/prototype/run`으로 요약 1건(완료 여부·마지막 단계·총 소요·추천 수·재탐색 수·오류 코드·버전·기기 구분)을 서버 저장소에 남겨요. 이름·문장은 없어요.
