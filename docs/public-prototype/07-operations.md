# 운영 가이드: 한도·예산·킬 스위치·장애 대응

## 보호 장치 요약 (`server/usage-guard.ts`, 값은 환경변수)
순서대로 검사하고, 막히면 **429(또는 503)** + 한국어 안내 + `Retry-After` 헤더를 줘요.
| 순서 | 장치 | 기본값 | 코드(`code`) |
|---|---|---|---|
| 1 | 킬 스위치 `PUBLIC_DEMO_ENABLED=false` | 켜짐 | `demo_disabled`(503) |
| 2 | 하루 전체 AI 호출 예산 `DAILY_GLOBAL_REQUEST_BUDGET` | 1500 | `daily_budget_exhausted` |
| 3 | 동시 AI 요청 `MAX_CONCURRENT_AI_REQUESTS` | 4 | `busy` |
| 4 | 분당 세션·IP `RATE_LIMIT_PER_MINUTE` | 10 | `too_many_requests` |
| 5 | 하루 세션 `RATE_LIMIT_PER_DAY_PER_SESSION` / IP `RATE_LIMIT_PER_DAY_PER_IP` | 60 / 120 | `daily_limit` |
추가로: 입력 `MAX_INPUT_CHARS`(500자), AI에 보내는 대화 `MAX_CONVERSATION_TURNS`(12턴), 요청 본문 100KB, 대화 배열 200개 초과 거부, 출력 `GROQ_MAX_OUTPUT_TOKENS`(600), 호출 `GROQ_REQUEST_TIMEOUT_MS`(15초), 재시도는 429·5xx·네트워크 오류에 **1회**. 모델은 `GROQ_MODEL`로 서버가 정하고 클라이언트 값은 무시해요. 날짜 기준은 **한국 시간 0시**.

## 조정 방법
Render → 서비스 → Environment에서 값을 바꾸고 저장하면 재시작되며 반영돼요. 잘못된 값(범위 밖·숫자 아님)은 무시하고 기본값을 써서 한도가 무제한으로 풀리지 않아요. 처음엔 기본값으로 시작하고, `/api/ops/usage`와 Groq 콘솔을 보며 올리세요.

## 예산(비용) 보호의 의미
- 달러·원화 비용을 **정확히 계산하지 않아요.** 요청 수와 **토큰 추정치**(입력 글자 수÷2 + 출력 상한)를 예산 대용 지표로 기록해요. 추정치를 비용으로 확정해 표시하지 않아요.
- 실제 비용 상한은 **Groq 콘솔의 사용량·결제 한도**로도 걸어 두세요(서버 예산은 1차 방어선).

## 운영자가 보는 곳
- `GET /api/ops/usage`(헤더 `x-ops-token: <OPS_TOKEN>`): `{ day, requests, requestBudget, estimatedTokens, blockedRequests, inflight, budgetExhausted }` — 숫자만. `OPS_TOKEN`이 없거나 틀리면 404예요.
- 서버 로그: `[nodi:budget] 50%/80%/100% of daily request budget (...)`(하루에 한 번씩), `[nodi:error] <오류 코드>`. 사용자 입력·키·식별자는 남기지 않아요.
- `/api/health`: `aiConfigured`(키 설정 여부만), `publicDemoEnabled`.

## 한계(꼭 알아 두세요)
- 한도·예산 카운터는 **서버 프로세스 메모리**예요. Render 재시작·재배포 때 **초기화**되고, 서비스를 2대 이상으로 늘리면 **인스턴스별로 따로 세요**(한도가 실질적으로 늘어나요). 규모를 키우면 Redis 같은 공유 저장소로 옮기세요(`usage-guard.ts`의 `ponytail` 주석). 지금 규모(1대, 무료/스타터 플랜)에는 충분해요.
- 무료 플랜은 잠들었다 깨어나서 첫 접속이 느려요. 잠든 사이에는 카운터가 쌓이지 않아요.
- 같은 공유기·회사망 사용자는 IP 한도를 같이 써요(`RATE_LIMIT_PER_DAY_PER_IP`를 넉넉히).
- 세션이 300개를 넘으면 새 세션을 거절해요(`busy`).

## 장애 대응
| 증상(사용자 메시지) | 원인 | 조치 |
|---|---|---|
| "AI 연결 설정이 아직 끝나지 않았어요" (`ai_not_configured`) | `GROQ_API_KEY` 미설정 | Render 환경변수에 키 입력 후 저장 |
| "AI 연결에 문제가 있어요" (`ai_unavailable`) | 키가 잘못/폐기됨(Groq 401) | 키 재발급 → Render 교체 |
| "요청이 너무 많아요" (`too_many_requests`) | 분당 한도 | 정상. 반복되면 `RATE_LIMIT_PER_MINUTE` 점검 |
| "오늘 … 횟수를 모두 썼어요" (`daily_limit`) | 일일 한도 | 정상(다음 날). 공유망이면 IP 한도 상향 |
| "오늘 준비한 테스트용 AI 사용량을 모두 썼어요" (`daily_budget_exhausted`) | 전체 예산 소진 | 의도된 보호. 필요하면 예산 상향 후 재시작(카운터 초기화) |
| "지금 요청이 몰리고 있어요" (`busy`) | 동시 요청 한도 | 잠시 후. 잦으면 `MAX_CONCURRENT_AI_REQUESTS` 상향 |
| "지금은 테스트를 잠시 쉬고 있어요" (`demo_disabled`) | 킬 스위치 | `PUBLIC_DEMO_ENABLED=true`로 복구 |
| 응답 지연·"AI 요청에 실패했어요" | Groq 장애·타임아웃 | Groq 상태 확인, 선택지 흐름은 계속 가능. 길면 킬 스위치로 잠시 중단 |
| 피드백 저장 실패 | Supabase 설정·네트워크 | `SUPABASE_*` 확인, 서버 로그의 `[nodi:error]` |

## Groq 키가 노출됐다고 의심될 때
1. **즉시** Groq 콘솔에서 해당 키를 **폐기(Revoke)**하고 새 키를 발급하세요.
2. Render의 `GROQ_API_KEY`를 새 키로 교체·저장(재시작).
3. 필요하면 `PUBLIC_DEMO_ENABLED=false`로 먼저 막으세요.
4. `bash scripts/check-secrets.sh`로 저장소·히스토리·번들을 다시 점검하세요. 실제 키가 발견되면 값은 출력하지 말고 파일·위치만 확인한 뒤 Git 히스토리 정리를 따로 진행하세요.
