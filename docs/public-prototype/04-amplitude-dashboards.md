# Amplitude 퍼널·차트·대시보드 설정

> Amplitude 화면은 업데이트로 이름·위치가 바뀔 수 있어요. 아래는 2026년 기준 일반적인 경로이고, 막히면 공식 문서(https://amplitude.com/docs/analytics/charts/funnel-analysis/funnel-analysis-build)를 참고하세요. 이벤트가 한 번도 들어오지 않으면 목록에 이벤트가 안 보이니, 먼저 [09 검증](09-event-validation.md)로 데이터를 확인하세요.

## 1. 핵심 퍼널 만들기 (Funnel Analysis)
1. 왼쪽 **Create → Chart → Funnel Analysis**.
2. 단계(Events)를 **이 순서로** 추가해요:
   1. `meeting_flow_started`
   2. `meeting_details_completed`
   3. `participants_configured`
   4. `recommendations_requested`
   5. `recommendations_viewed`
   6. `recommendation_selected`
   7. `meeting_confirmed`
3. **Counting by: Unique users**, 순서는 **This order**(정확히 이 순서대로 거친 사용자만 다음 단계로 셈).
4. **Conversion window**: 처음엔 **1시간**으로 두세요. 이유: 이 서비스의 한 흐름은 보통 몇 분이고, 하루로 늘리면 "내일 다시 와서 끝낸 사람"이 섞여 단계 소요를 해석하기 어려워요. 데이터가 적을 땐 1일까지 늘려 비교해도 돼요.
5. **필터(Segment)**: 반드시 아래를 걸어요.
   - `environment` = `production`
   - `test_mode` = `fictional_calendar`
6. **Group by(분해)**: `device_category` → 이어서 `flow_version`, `experiment_variant`로 바꿔 보세요. 한 번에 하나씩 쓰면 숫자가 너무 잘게 쪼개져요.
7. 저장 이름: `NODI 핵심 퍼널 (production)`.

## 2. 차트 11개
| # | 차트 | 만드는 법 |
|---|---|---|
| 1 | 핵심 퍼널 | 위 1번 |
| 2 | 일별 시작 수 | Event Segmentation, `meeting_flow_started`, Uniques, 일 단위 |
| 3 | 완료율 | 위 퍼널의 첫 단계→`meeting_confirmed` 전환율 |
| 4 | 기기별 완료율 | 핵심 퍼널 + Group by `device_category` |
| 5 | 흐름 버전별 완료율 | 핵심 퍼널 + Group by `flow_version` |
| 6 | 실험군별 완료율 | 핵심 퍼널 + Group by `experiment_variant` |
| 7 | 추천 표시까지 걸린 시간 | Event Segmentation, `recommendations_viewed`, 속성 `elapsed_ms` 평균/중앙값 |
| 8 | 확정까지 걸린 시간 | `meeting_confirmed`의 `total_elapsed_ms` |
| 9 | 재탐색 횟수 | `recommendation_regenerated` 건수 또는 `meeting_confirmed`의 `regeneration_count` |
| 10 | 오류 | `prototype_error`를 `error_code`로 분해(`recoverable`로 한 번 더) |
| 11 | 이탈 지점 | `flow_abandoned`를 `last_completed_step`으로 분해 |

피드백 점수(`feedback_submitted`의 `feedback_score`/`ease_score`)는 *참고용*이에요. 자유 의견은 Amplitude에 없고 서버 저장소에 있어요([11](11-feedback-check.md)).

## 3. 대시보드
**Dashboard → New** → 이름 `NODI Public Test Overview` → 위 차트를 추가해요. 위쪽에 퍼널·완료율, 가운데에 기기·버전·실험군 비교, 아래에 시간·오류·이탈을 두면 읽기 편해요. 대시보드 전체에 `environment = production` 필터를 걸어 두세요.

## 4. 기기·버전·실험 비교 읽는 법
- 같은 기간에 `device_category`별 완료율을 나란히 봐요. 차이가 있으면 어느 *단계*에서 갈리는지 퍼널 단계별 이탈을 보고, `prototype_error`가 그 기기에 몰려 있지 않은지 확인해요.
- 흐름을 바꾸면 `VITE_FLOW_VERSION`을 올려 배포하고 `flow_version`으로 이전/이후를 비교해요. 같은 기간 비교가 아니면 요일·유입이 달라 비교가 흔들려요.
- 실험은 `VITE_EXPERIMENT_ID`를 정하면 익명 ID에서 결정론적으로 `control`/`variant_a`가 나뉘어요. **현재 코드는 변형을 나눌 뿐 화면을 바꾸지 않아요** — 화면 차이는 실험 때 따로 구현하세요.

## 5. 무료 플랜 대안
일부 기능(예: 분석 한도, 행동 코호트)이 제한될 수 있어요. 막히면 ① 차트 대신 Event Segmentation 표로 단계별 Uniques를 직접 비교하고 ② 필터를 줄이고 ③ 기간을 7일 이내로 두세요. 한도·기능은 플랜 안내 페이지에서 확인하세요.
