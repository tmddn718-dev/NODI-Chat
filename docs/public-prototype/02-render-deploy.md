# Render 배포·롤백 가이드

기존 서비스(`NODI-Chat`=main 배포, `nodi-demo`=데모)는 **그대로 두고**, 공개 테스트는 **새 서비스 `nodi-public`**으로 따로 만들어요. 운영 배포는 사용자(운영자)가 직접 해요.

## 1. 배포 전 준비 (사용자가 직접)
- [ ] **PostHog 프로젝트 만들기**(운영용·개발용 분리) → 프로젝트 키 확보. 프로젝트 설정에서 *Discard client IP data*를 켜세요(IP를 저장하지 않게).
- [ ] **결과 저장소 결정**: 피드백·흐름 요약을 Render 재시작 후에도 보관하려면 Supabase를 쓰세요(아래 3번). 안 쓰면 로컬 파일에 저장되어 재배포 때 사라져요.
- [ ] 개인정보 안내에 넣을 **보존 기간·문의처** 결정(`VITE_DATA_RETENTION_DAYS`, `VITE_PRIVACY_CONTACT`).
- [ ] Groq 사용량 한도와 **하루 예산**(`DAILY_GLOBAL_REQUEST_BUDGET`) 결정. Groq 콘솔에서도 사용량 알림을 켜 두세요.

## 2. 서비스 만들기
1. Render → **New + → Blueprint** → 저장소 `NODI-Chat` → **Blueprint Path: `render.public.yaml`** → 브랜치 선택(`feat/public-prototype-test` 또는 합친 뒤의 브랜치).
2. 입력 칸이 나오는 변수(`sync: false`)를 대시보드에서 채워요: `GROQ_API_KEY`(비밀), `OPS_TOKEN`(비밀, 길고 무작위로), `NODI_PUBLIC_URL`(배포 주소), `VITE_POSTHOG_KEY`, (선택) `SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`, `VITE_PRIVACY_CONTACT`, `VITE_DATA_RETENTION_DAYS`.
3. **비밀값은 Render 대시보드에만** 입력해요. 저장소·문서·`VITE_` 변수에는 넣지 않아요.
4. 빌드 명령 `npm ci --include=dev && npm run build`, 시작 명령 `npm start`, 상태 확인 `/api/health`(비밀 없이 상태만 반환: `aiConfigured`는 키 설정 여부일 뿐 값은 없어요).
5. `autoDeploy: false`라서 **확인 후 수동 배포**해요.

## 3. 결과 저장소(Supabase, 선택)
기존 프로젝트에는 DB가 없고 데이터가 JSON 파일이라(Render 재시작·재배포 때 사라짐), 구조화된 결과를 남기려면 Supabase를 권해요.
1. Supabase 프로젝트 생성 → SQL Editor에서 [`supabase/migrations/0001_prototype_tables.sql`](../../supabase/migrations/0001_prototype_tables.sql) 실행(테이블 2개, RLS 켜짐·정책 없음 = 익명 키로는 접근 불가).
2. **Project URL**과 **service_role 키**를 Render의 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`에 입력(서버 전용). anon 키는 쓰지 않아요.
3. 배포 후 피드백을 하나 제출해 *Table editor*에 행이 생기는지 확인하세요.

## 4. 프록시와 허용 Origin
- Render는 프록시 1단 뒤에 있어요: `TRUST_PROXY_HOPS=1`이면 서버가 `X-Forwarded-For`의 실제 클라이언트 IP로 IP 한도를 적용해요. **앞에 Cloudflare 등을 더 두면** 그 단수만큼 올리세요(잘못 올리면 IP 한도를 우회당해요).
- 같은 출처(NODI 화면 → NODI 서버) 요청은 항상 허용돼요. 다른 출처에서 오는 브라우저의 상태 변경 요청은 `NODI_PUBLIC_URL`/`ALLOWED_ORIGINS`에 있을 때만 허용하고 나머지는 403이에요(개발 환경에서만 localhost 허용).

## 5. 배포 후 smoke test (순서대로)
1. `https://<주소>/api/health` → `{"ok":true,"mode":"public","aiConfigured":true,"publicDemoEnabled":true}`
2. 주소를 열면 **동의 안내**가 보이고, "동의하지 않고 사용"으로도 시작되는지.
3. 선택지로 회의 조건을 끝까지 정하고, 후보 찾기 → 시간 선택 → 확정까지 완료.
4. 자유 입력 한 번("내일 오후에 30분") → AI가 조건을 반영하는지(키·한도 확인).
5. 확정 화면의 **의견 남기기**로 피드백 제출 → 저장소(Supabase 또는 서버 파일)에 행이 생겼는지.
6. 브라우저 네트워크 패널로 [QA 체크리스트](08-qa-checklist.md)의 1~5번 확인.
7. `GET /api/ops/usage`(헤더 `x-ops-token`)로 사용량 숫자가 올라가는지.

## 6. 롤백
1. 먼저 **킬 스위치**: `PUBLIC_DEMO_ENABLED=false`로 바꾸고 저장 → 서비스가 재시작되며 AI 호출과 새 세션이 즉시 막혀요(점검 안내가 보여요).
2. 코드 문제면 Render 서비스 → **Events/Deploys**에서 이전 성공 배포를 **Rollback**(또는 이전 커밋을 수동 배포).
3. `VITE_` 변수 문제(잘못된 PostHog 키 등)는 값을 고치고 **다시 배포**해야 해요(빌드 시점 값).
4. Groq 키 노출이 의심되면 → [운영 가이드](07-operations.md)의 키 유출 대응.

## 7. 공개 중단(킬 스위치) 사용법
- 중단: `PUBLIC_DEMO_ENABLED=false` → 저장(자동 재시작). 사용자는 "지금은 테스트를 잠시 쉬고 있어요" 안내를 봐요.
- 재개: `true`(또는 변수 삭제)로 바꾸고 저장.
- 예산 소진 시에는 서버가 스스로 새 AI 호출을 막아요(다음 날 한국 시간 0시에 초기화).

## 8. 대시보드에서 확인할 운영 항목
- **Render**: 배포 상태, 재시작 횟수, 메모리, 로그의 `[nodi:budget]`·`[nodi:error]` 줄(숫자와 오류 종류만 있고 사용자 입력은 없어요).
- **Groq 콘솔**: 일일 요청·토큰 사용량, 429 비율.
- **PostHog**: 이벤트 수신 여부, `environment` 값, 퍼널([04](04-posthog-dashboards.md)).
- **Supabase**: `prototype_runs`, `prototype_feedback` 행 증가, 저장소 용량.
