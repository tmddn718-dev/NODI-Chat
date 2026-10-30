# 이벤트 검증·디버깅 가이드

배포 직후와 대시보드 숫자가 이상할 때 이 순서로 확인하세요.

## 1. 브라우저에서 (개발자 도구 → Network)
1. 저장소를 지우고(Application → Clear site data) 첫 진입 → 동의 안내만 보이고 `amplitude` 요청이 **0건**이어야 해요.
2. "동의하고 시작" → `api2.amplitude.com`(EU는 `api.eu.amplitude.com`)의 `/2/httpapi`로 POST가 가요. 요청 본문(`events`)에서 확인:
   - `event_type`이 이벤트 사전의 이름이고, `event_properties`에 **코드형 값만** 있다(이름·문장·일정 제목 없음).
   - `user_id` 없음, `ip`가 `null`이거나 없음. 자동 이벤트(`[Amplitude] ...`)·Session Replay 요청 없음.
3. 철회 → 이후 조작해도 요청이 없고 `localStorage`의 `nodi_anon_id`·`AMP_*`가 사라져요.

## 2. Amplitude에서
| 도구 | 용도 | 경로(대략) |
|---|---|---|
| **User Lookup** | 한 사용자의 이벤트 흐름을 시간순으로 | Users → User Look-Up (Device ID 또는 `anonymous_session_id`로 검색) |
| **Ingestion Debugger / Events 수신 확인** | 이벤트가 들어오는지, 거부됐는지 | Data → 소스/수집 상태(또는 Ingestion Debugger) |
| **Instrumentation Explorer** | 이벤트·속성 이름 점검 | Data → Events / Properties |
| **Live/Stream 보기** | 방금 보낸 이벤트 | 프로젝트의 실시간 이벤트 보기 |

## 3. 자주 쓰는 점검
- **중복**: User Lookup에서 한 흐름 동안 `meeting_flow_started`·`participants_configured`·`meeting_confirmed`가 **한 번씩**인지. `recommendations_requested`·`recommendations_viewed`는 재탐색 때만 늘 수 있어요.
- **환경 섞임**: 차트에 `environment`로 Group by → `production` 외 값이 있으면 개발·스테이징 데이터예요(필터로 제외).
- **개인정보**: 임의 이벤트 몇 개의 속성을 열어 사람 이름·문장이 없는지 확인. 있으면 즉시 [07 운영](07-operations.md)의 중단 절차.
- **`anonymous_session_id` 추적**: 특정 참여자의 흐름 확인이 필요하면 그 사람의 브라우저 `localStorage.nodi_anon_id`를 본인 동의 하에 받아 User Lookup 검색에 써요.

## 4. 이벤트가 안 들어올 때
| 증상 | 원인 후보 |
|---|---|
| 요청이 아예 없음 | 동의 안 함 / `VITE_AMPLITUDE_API_KEY` 비어 있음(배포 후 변수 변경은 **재배포 필요**) / 개발 빌드에서 `VITE_ANALYTICS_IN_DEV` 없음 |
| 요청은 가는데 4xx | 지역 불일치(US 키로 EU 서버 등) → `VITE_AMPLITUDE_SERVER_ZONE` 확인 |
| 요청은 성공인데 안 보임 | 광고 차단기, 프로젝트(운영/개발) 착오, 수집 지연(수 분) |
| `/api/health`의 `analyticsConfigured`가 false | 서버에 키가 설정되지 않음(`render.public.yaml`의 `sync:false` 값 미입력) |
