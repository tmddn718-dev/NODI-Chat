# Amplitude 계정·프로젝트·API Key 준비

> 이 문서의 단계는 **운영자(사용자)가 직접** 해요. 코드 작업 중에는 계정을 만들거나 키를 입력하지 않았어요. 화면 이름은 Amplitude 업데이트로 조금 달라질 수 있어요(공식 문서: https://amplitude.com/docs).

## 1. 계정과 프로젝트
1. https://amplitude.com 에서 계정을 만들어요(무료 Starter 플랜으로 충분해요. 유료 전환은 하지 마세요).
2. **데이터 지역(US/EU)을 처음에 고르면 바꾸기 어려워요.** 한국 사용자 대상이면 보통 US로 시작해도 되고, 유럽 데이터 거주가 필요하면 EU를 고르세요. 선택한 지역은 `VITE_AMPLITUDE_SERVER_ZONE`(`US` 또는 `EU`)과 **같아야** 해요.
3. **프로젝트를 환경별로 나눠요**(권장). 한 프로젝트에 섞으면 테스트 데이터가 운영 분석을 오염시켜요.
   - `NODI Public Prototype - Production` ← 외부 테스트용(`nodi-public`)
   - `NODI Public Prototype - Development` ← 개발·QA용
4. **IP·위치**: Amplitude는 이 앱 SDK의 `ipAddress: false` 설정으로 IP를 *받지 않아요*. 다만 Amplitude 문서상 이 설정이 완전하게 동작하는 것은 **데이터가 아직 없는 새 프로젝트**일 때예요. 그래서 **운영 프로젝트는 새로 만들고**, 예전 PostHog 테스트 같은 다른 데이터를 섞지 마세요. 위치(국가·도시) 속성이 보이면 [05](05-privacy-consent.md)의 한계 항목을 따르세요.

## 2. API Key 두 종류 — 헷갈리지 마세요
| 이름 | 어디에 쓰나 | 공개해도 되나 |
|---|---|---|
| **API Key (Project API Key)** | 브라우저에서 이벤트를 *보낼* 때 | 번들에 들어가므로 **공개 값**이에요. 이벤트를 쓰기만 하고 읽을 수는 없어요 |
| **Secret Key** | 서버에서 데이터를 *읽거나 내보낼* 때 | **절대 금지**: 코드·`VITE_` 변수·문서·채팅에 넣지 마세요 |

- 가져오는 위치: Amplitude → **Organization Settings → Projects → (프로젝트) → General → API Key**.
- 이 앱에는 **API Key만** 필요해요. Secret Key는 필요 없고, 저장소 검사(`scripts/check-secrets.sh`)가 관련 변수를 찾으면 실패해요.
- 키가 노출돼도 읽기 권한은 없지만, 누군가 가짜 이벤트를 보낼 수 있어요. 의심되면 프로젝트를 새로 만들고 키를 교체해요.

## 3. Render 환경변수
`nodi-public` 서비스 → Environment에서 입력해요(`VITE_` 값은 **빌드 때** 들어가므로 바꾸면 **다시 배포**해야 해요).

| 변수 | 값 | 비고 |
|---|---|---|
| `VITE_AMPLITUDE_API_KEY` | 운영 프로젝트의 API Key | 비면 분석만 꺼지고 앱은 정상 동작 |
| `VITE_AMPLITUDE_SERVER_ZONE` | `US` 또는 `EU` | 프로젝트 지역과 같게 |
| `VITE_ANALYTICS_ENVIRONMENT` | `production` | 대시보드 필터 기준 |
| `VITE_APP_VERSION` | 선택(비면 빌드 버전) | 배포 비교용 |
| `VITE_FLOW_VERSION` | `flow-1` | 흐름을 바꿀 때 올려요 |
| `VITE_EXPERIMENT_ID` | `none` 또는 실험 이름 | `none`이면 모든 사용자의 `experiment_variant`가 `none` |
| `VITE_PRIVACY_CONTACT`, `VITE_DATA_RETENTION_DAYS` | 운영자가 정한 값 | 동의 안내에 표시 |

## 4. 로컬에서 시험하기
`.env`(gitignore 대상)에 **개발용 프로젝트** API Key와 `VITE_ANALYTICS_IN_DEV=true`를 넣으면 개발 서버도 이벤트를 보내요. 둘 중 하나라도 없으면 개발 빌드는 아무것도 안 보내요(운영 프로젝트에 섞이지 않게).
