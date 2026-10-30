# 분석 이벤트 사전

구현: `src/analytics.ts`(전송·허용 목록), `src/flow.ts`(퍼널 시점·중복 방지), `src/consent.ts`(동의·익명 ID). 이벤트 이름은 지시서의 권장 이름을 그대로 써요(매핑 불필요).

## 원칙
- **동의한 사용자의 명시적 이벤트만** 보내요. PostHog 자동 캡처·세션 리플레이·`identify`는 쓰지 않아요(`posthog-js`를 쓰지 않고 `/capture/` 전송만 구현).
- 모든 이벤트는 `$process_person_profile: false`(사용자 프로필 없음)로 가요. 쿠키 없이(`credentials: omit`) 가요.
- **허용 목록**: 아래 표의 속성만 나가고, 값은 숫자·불리언·짧은 코드형 문자열(`[a-z0-9_.+-]{1,48}`)만 허용돼요. 이름·이메일·문장이 실수로 섞여도 버려져요(`sanitize`, 테스트로 검증).
- 키가 없거나, 동의하지 않았거나, 개발 빌드(`VITE_ANALYTICS_IN_DEV` 없이)면 아무것도 안 보내요.

## 공통 속성(모든 이벤트)
`anonymous_session_id`, `app_version`, `flow_version`, `experiment_id`, `experiment_variant`, `test_mode`(= `fictional_calendar`), `environment`, `device_category`(mobile/tablet/desktop), `viewport_bucket`(lt360·360_479·480_767·768_1023·1024_1199·1200_1599·gte1600), `locale`(ko/en/other), `step_name`, `elapsed_ms`(해당될 때)
- 기기 구분은 CSS 반응형 기준과 같아요(모바일 ≤767, 태블릿 768~1199, 데스크톱 ≥1200). **세션이 시작될 때 한 번 정해서 고정**돼요(회전·리사이즈로 바뀌지 않아요). User-Agent 원문은 보내지 않아요.
- `step_name`: consent · conditions · participants · search · recommendations · confirm · feedback · done

## 이벤트
| 이벤트 | 발생 시점(한 번씩) | 속성 |
|---|---|---|
| `prototype_viewed` | 동의한 사용자가 화면을 열 때(페이지 로드당 1회) | `entry`: direct/internal/external |
| `analytics_consent_updated` | 동의할 때, 그리고 **철회 직전 1회** | `consent_status`: granted/withdrawn, `policy_version` |
| `meeting_flow_started` | 첫 선택지 클릭 또는 첫 자유 입력 | `start_method`: guided/typed |
| `meeting_details_completed` | 필요한 회의 조건이 모두 정해졌을 때 | `input_method`: guided/typed/mixed |
| `participants_configured` | 참석자가 정해졌을 때 | `participant_count_bucket`: 1·2-3·4-10·11-30·31plus |
| `recommendations_viewed` | 후보가 화면에 나타날 때(후보 세트가 바뀌면 다시 1회) | `recommendation_count`, `generation_ms` |
| `recommendation_selected` | "이 시간으로 확정 검토"를 누를 때 | `recommendation_rank`, `is_first_recommendation` |
| `recommendation_regenerated` | 후보 새로 찾기 / 다른 후보 확인 | `regenerate_count`, `reason`: refresh/conditions_changed/no_candidates |
| `meeting_confirmed` | 가상 회의 최종 확정 성공 | `total_ms`, `step_count` |
| `flow_abandoned` | 아래 이탈 규칙 | `abandon_reason`: restart/page_hidden |
| `prototype_error` | 사용자 경험에 영향을 준 오류(코드별 단계당 1회) | `error_code`(예: `too_many_requests`, `daily_limit`, `no_candidates`, `http_500`, `unknown`) |
| `feedback_opened` | 피드백 창을 열 때 | `completed`(확정을 마친 뒤인지) |
| `feedback_submitted` | 피드백 제출 성공 | `overall_score`, `ease_score`, `tags`(사전 정의 태그), `run_id` |

## 이탈 판정 규칙
- ① "새 대화"로 명시적으로 다시 시작하면 `restart`, ② 흐름을 **시작했지만 확정하지 않은 채** 페이지가 닫히면(`pagehide`) `page_hidden`.
- ②는 근사치예요: 탭을 닫았다가 같은 초안으로 돌아올 수 있어서 실제 이탈보다 많게 잡힐 수 있어요. 한 run에서 이탈은 한 번만, 확정한 run은 이탈로 세지 않아요.
- 초안을 복원해 이어서 한 경우에는 `meeting_flow_started`가 없는 run이 생길 수 있어요(시작 이벤트는 처음 한 번만 보내요).

## 중복 방지
`flow.ts`가 run(회의 만들기 한 번)마다 이벤트를 키로 한 번씩만 보내요. 화면이 다시 그려져도(React 재렌더·StrictMode) 같은 후보 세트는 한 번만 집계돼요.

## 금지 데이터
이름·이메일·전화번호·회사명, 실제 캘린더 제목·참석자, **입력 문장 원문**, Groq 프롬프트·응답, API 키·토큰·쿠키 값, **피드백 자유 의견 원문**. 자유 의견은 서버 저장소에만 가요.

## 서버로 가는 "흐름 요약"(분석 이벤트 아님)
동의한 사용자가 확정하거나 이탈하면 `POST /api/prototype/run`으로 요약 1건(완료 여부·마지막 단계·총 소요·추천 수·재탐색 수·오류 코드·버전·기기 구분)을 저장소에 남겨요. 이름·문장은 없어요. PostHog의 모든 이벤트를 복제하지 않고, 결과 분석에 필요한 것만 둬요.
