# PostHog 퍼널·기기·버전·실험군 대시보드 설정 절차

PostHog에서 **수동으로** 만드는 절차예요(코드는 이벤트만 보내요). 모든 인사이트에 공통으로 다음 필터를 걸어요.
- `environment` = `production` (스테이징·개발 데이터 제외)
- `test_mode` = `fictional_calendar`
- 기간은 실험·버전 배포 시점 이후로 좁히세요.

## 사전 설정
1. 프로젝트 설정 → **Discard client IP data** 켜기. (이벤트가 사용자 프로필을 만들지 않도록 이미 `$process_person_profile=false`로 보내요.)
2. *Autocapture*·*Session replay*는 이 프로젝트에서 켜지 않아요(코드가 켜지 않고, 켜도 이 앱은 해당 SDK를 쓰지 않아요).
3. 운영 프로젝트와 개발 프로젝트를 분리하고, `VITE_POSTHOG_KEY`를 환경별로 다르게 넣으세요.

## 1. 핵심 퍼널
*Product analytics → New insight → Funnels*, 순서대로 단계 추가(**Sequential**, 같은 사용자 기준):
1. `meeting_flow_started`
2. `meeting_details_completed`
3. `participants_configured`
4. `recommendations_viewed`
5. `recommendation_selected`
6. `meeting_confirmed`

> 참가자가 선택지만 쓰면 `participants_configured`가 `meeting_details_completed`보다 **먼저** 발생할 수 있어요(참석자를 먼저 고른 뒤 나머지가 채워지면 조건 완료). 순서가 어긋나면 두 단계를 **Any order**로 묶어 보세요. 전환 시간 창(*conversion window*)은 1시간으로 두세요.

저장 이름: `NODI 핵심 퍼널`. 이 퍼널 하나에서 아래 2~3번(단계별 전환율·이탈률, 시작→확정 시간)을 확인해요.

## 2. 단계별 전환율과 이탈률
퍼널 결과의 단계별 *Conversion*과 *Dropped off* 값을 써요. 이탈 이유를 좁히려면 이탈 단계에서 `prototype_error`·`flow_abandoned`를 *Persons who dropped off*로 확인하세요(`abandon_reason`, `error_code` 속성).

## 3. 시작부터 확정까지 걸린 시간
퍼널 상단 *Time to convert*(1→6단계). 또는 `meeting_confirmed`의 `total_ms` 평균·중앙값(*Trends → Property value (avg/median)*)을 보세요. 평균은 이상치에 약하니 **중앙값**을 함께 보세요.

## 4. 첫 추천 선택률
*Trends*, 이벤트 `recommendation_selected`, 속성 `is_first_recommendation`으로 **Breakdown** → `true` 비율 = 첫 추천 선택률.

## 5. 재탐색률과 평균 재탐색 횟수
- 재탐색률 = `recommendation_regenerated`를 한 번이라도 한 사용자 ÷ `recommendations_viewed` 사용자. (*Funnel* `recommendations_viewed` → `recommendation_regenerated`)
- 평균 재탐색 횟수: `meeting_confirmed`가 아닌 `recommendation_regenerated`의 `regenerate_count` 최댓값 평균(*Trends → Property value → Max per user*의 평균). 사유별 분포는 `reason` 브레이크다운.

## 6. 오류율과 오류 코드별 빈도
- 오류율 = `prototype_error` 발생 사용자 ÷ `meeting_flow_started` 사용자.
- 코드별 빈도: `prototype_error`를 `error_code`로 Breakdown. 자주 보이는 코드: `too_many_requests`(분당 한도), `daily_limit`·`daily_budget_exhausted`(일일 한도/예산), `no_candidates`(후보 없음), `ai_unavailable`·`ai_not_configured`(AI 설정), `http_5xx`.

## 7. 기기별 완료율과 소요 시간
핵심 퍼널에 **Breakdown → `device_category`**(mobile/tablet/desktop). 소요 시간은 `meeting_confirmed`의 `total_ms`를 같은 속성으로 Breakdown. 세부 구간은 `viewport_bucket`.

## 8. 버전·실험군 비교
핵심 퍼널에 **Breakdown**을 `flow_version`, `app_version`, `experiment_variant` 순으로 바꿔 가며 비교해요. 실험이 없으면 `experiment_variant`는 모두 `none`이에요. 실험을 켜려면 `src/prototype.ts`의 `experiment`를 채우세요.

## 대시보드 구성
이름 `NODI 공개 테스트`: ①핵심 퍼널 ②시작→확정 시간(중앙값) ③첫 추천 선택률 ④재탐색률 ⑤오류 코드별 빈도 ⑥기기별 완료율 ⑦버전·실험군 비교 ⑧`feedback_submitted`의 `overall_score`·`ease_score` 분포.

## 분석할 때 주의
- **동의한 사용자만** 집계돼요. 동의율이 낮거나 동의한 사람만 특정 성향이면 전체와 다를 수 있어요(동의 이벤트 `analytics_consent_updated`로 동의 건수는 알 수 있지만 거부는 집계되지 않아요).
- 표본이 작을 때(예: 수십 건) 전환율 차이를 **확정적인 결론으로 쓰지 마세요.** 신뢰구간·재현을 확인하고 정성 피드백과 함께 해석하세요.
- 앱 버전·흐름 버전이 섞인 기간은 분리해서 보세요. 한 실험에서 여러 요소를 동시에 바꾸지 마세요.
- 이 테스트는 **가상 캘린더 기반**이에요. 결과나 포트폴리오 문서에 `test_mode = fictional_calendar`임을 밝히세요.
- 이탈(`page_hidden`)은 근사치라 실제 이탈보다 많을 수 있어요([03 문서](03-analytics-events.md) 참고).
