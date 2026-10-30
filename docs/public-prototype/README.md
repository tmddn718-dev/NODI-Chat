# NODI 공개 프로토타입 테스트 환경

외부 테스트 참여자가 **개인 API 키 없이** NODI를 써 보고, **동의한 경우에만 익명 행동 데이터**와 피드백을 남기는 공개 테스트 환경이에요.
1차 테스트는 실제 Google/Outlook 캘린더를 연결하지 않고 **명백히 가상인 일정**만 써요.

| 모드 | `NODI_MODE` | 시작 | AI 해석 | 용도 |
|---|---|---|---|---|
| 개발 | (없음) | API Key 입력 | 입력한 키로 Groq | 개발·내부 확인 |
| 데모 | `demo` | 버튼 | 규칙 기반(외부 호출 없음) | 포트폴리오 데모(`nodi-demo`) |
| **공개 테스트** | `public` | 버튼 | **서버 환경변수의 키**로 Groq | 이 문서의 대상 |

## 문서 목차
1. README(이 문서): 로컬 실행·환경변수
2. [Render 배포·롤백](02-render-deploy.md)
3. [분석 이벤트 사전](03-analytics-events.md)
4. [PostHog 퍼널·대시보드 설정](04-posthog-dashboards.md)
5. [개인정보·동의·세션 리플레이](05-privacy-consent.md)
6. [가상 캘린더 fixture](06-fictional-calendar.md)
7. [운영 가이드: 한도·예산·킬 스위치·장애 대응](07-operations.md)
8. [QA 체크리스트](08-qa-checklist.md)

## 구조 한눈에
```text
브라우저 ── (동의 후) 익명 이벤트 ──▶ PostHog        ※ 대화·이름·일정 내용은 보내지 않아요
   │
   └── /api/* ──▶ NODI 서버(Express) ──▶ Groq        ※ 키는 서버 환경변수에서만 읽어요
                    ├─ 사용량 보호(분당·일일·전역 예산·동시 요청·킬 스위치)
                    ├─ 가상 캘린더(방문자별 메모리 저장, 실제 캘린더·메일 없음)
                    └─ 결과 저장(피드백·흐름 요약): Supabase(선택) 또는 로컬 파일
```

## 로컬 실행
```bash
cp .env.example .env            # .env는 gitignore 대상이에요. 값만 채우세요(문서·커밋에 실제 값 금지).
# 서버(키를 환경변수로 읽어요. 파일에서 읽으려면 --env-file)
npx tsx --env-file=.env server/index.ts      # NODI_MODE=public, GROQ_API_KEY=... 가 .env에 있어야 해요
# 화면(Vite가 .env의 VITE_ 변수를 읽어요)
PORT=3001 npx vite --port 5173
```
- 분석을 로컬에서 시험하려면 `.env`에 `VITE_POSTHOG_KEY`(**개발용 별도 프로젝트** 키)와 `VITE_ANALYTICS_IN_DEV=true`를 넣으세요. 이 값이 없으면 개발 빌드는 이벤트를 보내지 않아요(운영 프로젝트에 섞이지 않게).
- 키 없이 화면만 보려면 `GROQ_API_KEY` 없이 실행하세요. 선택지 흐름은 동작하고, 자유 입력은 "AI 연결 설정이 아직 끝나지 않았어요"를 보여줘요.
- 검증: `npx tsc -b && npx vitest run && npm run build && bash scripts/check-secrets.sh`

## 환경변수
전체 목록과 설명은 [`.env.example`](../../.env.example)에 있어요. **서버**는 브라우저에 절대 노출되지 않고, **클라이언트**(`VITE_`)는 빌드 시점에 번들에 들어가 **공개**돼요.

| 변수 | 구분 | 비밀 | 기본값 | 설명 |
|---|---|---|---|---|
| `NODI_MODE` | 서버 | - | `groq` | `public`으로 공개 테스트 |
| `GROQ_API_KEY` | 서버 | **비밀** | 없음 | 없으면 AI 요청이 503(안전한 설정 안내)을 돌려줘요 |
| `GROQ_MODEL` | 서버 | - | `llama-3.3-70b-versatile` | 클라이언트는 모델을 정할 수 없어요 |
| `GROQ_MAX_OUTPUT_TOKENS` | 서버 | - | 600 | 출력 토큰 상한(서버가 강제) |
| `GROQ_REQUEST_TIMEOUT_MS` | 서버 | - | 15000 | Groq 호출 제한 시간 |
| `PUBLIC_DEMO_ENABLED` | 서버 | - | `true` | `false`면 AI 호출·세션 시작 즉시 중단 |
| `RATE_LIMIT_PER_MINUTE` | 서버 | - | 10 | 세션·IP 각각 분당 |
| `RATE_LIMIT_PER_DAY_PER_SESSION` | 서버 | - | 60 | 하루(한국 시간 기준) |
| `RATE_LIMIT_PER_DAY_PER_IP` | 서버 | - | 120 | 하루 |
| `MAX_INPUT_CHARS` | 서버 | - | 500 | 한 번에 입력할 수 있는 글자 수 |
| `MAX_CONVERSATION_TURNS` | 서버 | - | 12 | AI에 보내는 최근 대화 턴 수 |
| `DAILY_GLOBAL_REQUEST_BUDGET` | 서버 | - | 1500 | 하루 전체 AI 호출 수 상한 |
| `MAX_CONCURRENT_AI_REQUESTS` | 서버 | - | 4 | 동시 AI 요청 수 |
| `OPS_TOKEN` | 서버 | **비밀** | 없음 | 있어야 `/api/ops/usage`가 열려요 |
| `NODI_PUBLIC_URL` / `ALLOWED_ORIGINS` | 서버 | - | 없음 | 허용 Origin(같은 출처는 항상 허용) |
| `TRUST_PROXY_HOPS` | 서버 | - | 1 | Render는 1 |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | 서버 | **비밀** | 없음 | 둘 다 있으면 Supabase에 저장 |
| `VITE_POSTHOG_KEY` | 클라이언트 | 공개 | 없음 | PostHog **프로젝트 키**(phc_…). 개인용·관리용 키 금지 |
| `VITE_POSTHOG_HOST` | 클라이언트 | 공개 | `https://us.i.posthog.com` | 지역에 맞게(EU는 `https://eu.i.posthog.com`) |
| `VITE_ANALYTICS_ENV` | 클라이언트 | 공개 | `production`/`development` | 환경별 필터용 |
| `VITE_PRIVACY_CONTACT`, `VITE_DATA_RETENTION_DAYS` | 클라이언트 | 공개 | 없음 | 동의 안내에 표시(비면 "운영자가 별도로 안내해요") |

**환경별 값**: 개발=로컬 `.env`(개발용 PostHog 프로젝트), 스테이징=Render 별도 서비스(`VITE_ANALYTICS_ENV=staging`, 스테이징용 PostHog 프로젝트), 운영=`nodi-public`(운영 프로젝트). `VITE_` 값을 바꾸면 **다시 배포**해야 반영돼요.

## 버전·실험 설정(중앙)
`src/prototype.ts` 한 곳에서 관리해요: `appVersion`(빌드 시 `package.json` 버전 + Render 커밋 해시), `flowVersion`(흐름이 바뀔 때 수동으로 올려요), `experiment`(`{ id, variants }`, 실험이 없으면 `none`), 동의 정책 버전. 실험군은 익명 ID로 결정론적으로 배정돼 새로고침해도 유지되고, 동의하지 않은 사용자는 `none`이에요.
