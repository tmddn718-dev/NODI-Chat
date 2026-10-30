// 공개 프로토타입 테스트의 중앙 설정. 버전·실험·분석 설정은 모두 여기서만 읽어요.
// VITE_ 값은 빌드 시점에 번들에 들어가 브라우저에 그대로 공개돼요. 서버 비밀값(Groq 키, Amplitude 비밀 키 등)은 절대 넣지 않아요.
const env = import.meta.env as Record<string, string | undefined>;
const TOKEN = /^[A-Za-z0-9_.+-]{1,48}$/;
const token = (value: string | undefined, fallback: string) => (value && TOKEN.test(value.trim()) ? value.trim() : fallback);
const pick = <T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T => ((allowed as readonly string[]).includes(value ?? "") ? (value as T) : fallback);

export type AnalyticsEnvironment = "development" | "staging" | "production";
export type ExperimentVariant = "control" | "variant_a" | "variant_b" | "none";
// 실험을 켜면(VITE_EXPERIMENT_ID) 이 목록으로 배정해요. variant_b까지 쓰려면 여기에 추가하세요(한 실험에 한 가설만 바꾸는 걸 권해요).
export const EXPERIMENT_VARIANTS: readonly ExperimentVariant[] = ["control", "variant_a"];
const experimentId = token(env.VITE_EXPERIMENT_ID, "none");

export const PROTOTYPE = {
  // 빌드 시점에 고정: VITE_APP_VERSION, 없으면 package.json 버전 + Render 커밋 해시(vite.config.ts).
  appVersion: token(env.VITE_APP_VERSION, typeof __APP_VERSION__ === "string" ? token(__APP_VERSION__, "dev") : "dev"),
  // 대화·추천·확정 흐름이 바뀔 때 올려요(VITE_FLOW_VERSION으로도 덮어쓸 수 있어요).
  flowVersion: token(env.VITE_FLOW_VERSION, "flow-1"),
  testMode: "fictional_calendar" as const,
  // 동의 문구·수집 항목·분석 도구가 바뀌면 올려요. 올리면 모든 사용자가 다시 동의 여부를 정해요(이전 분석 도구 PostHog → Amplitude 교체로 올렸어요).
  consentPolicyVersion: "2026-11-02-amplitude",
  // 실험이 없을 땐 id "none"이고 모두 variant "none"이에요.
  experiment: { id: experimentId, variants: experimentId === "none" ? ([] as ExperimentVariant[]) : [...EXPERIMENT_VARIANTS] },
  // Amplitude 브라우저용 Project API Key(공개용). 비밀 키·관리 키는 절대 넣지 않아요.
  amplitudeApiKey: (env.VITE_AMPLITUDE_API_KEY ?? "").trim(),
  amplitudeServerZone: pick(env.VITE_AMPLITUDE_SERVER_ZONE?.trim().toUpperCase(), ["US", "EU"] as const, "US"),
  // 로컬 QA용 수신 서버나 자체 프록시 주소. 운영 배포에는 설정하지 않아요.
  amplitudeServerUrl: (env.VITE_AMPLITUDE_SERVER_URL ?? "").trim(),
  // 한 Amplitude 프로젝트에서 환경을 구분하는 이벤트 속성 값(운영 차트는 environment = production만 봐요).
  environment: pick(env.VITE_ANALYTICS_ENVIRONMENT, ["development", "staging", "production"] as const, import.meta.env.PROD ? "production" : "development") as AnalyticsEnvironment,
  // 개발 빌드에서는 명시적으로 허용했을 때만 이벤트를 보내요(운영 데이터에 섞이지 않게).
  allowInDevelopment: env.VITE_ANALYTICS_IN_DEV === "true",
  // 운영자가 정해서 채워요. 비어 있으면 화면에 "운영자가 안내해요"라고만 보여주고 거짓 값을 쓰지 않아요.
  privacyContact: (env.VITE_PRIVACY_CONTACT ?? "").trim(),
  retentionDays: (env.VITE_DATA_RETENTION_DAYS ?? "").trim(),
};
