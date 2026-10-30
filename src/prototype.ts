// 공개 프로토타입 테스트의 중앙 설정. 버전·실험·분석 설정은 모두 여기서만 바꿔요.
// 여기에 들어가는 값은 브라우저에 그대로 공개돼요(VITE_ 변수). 서버 비밀값(Groq 키 등)은 절대 넣지 않아요.
export const PROTOTYPE = {
  // 빌드 시점에 고정(package.json 버전 + Render 커밋 해시). 배포·실험 간 결과 비교에 써요.
  appVersion: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev",
  // 대화·추천·확정 흐름이 바뀔 때만 올려요(앱 버전과 별개로 흐름 단위로 결과를 비교하려는 값).
  flowVersion: "flow-1",
  testMode: "fictional_calendar" as const,
  // 동의 문구·수집 항목이 바뀌면 올려요. 올리면 모든 사용자가 다시 동의 여부를 정해요.
  consentPolicyVersion: "2026-11-01",
  // 실험이 없을 땐 id "none"이고 모두 variant "none"이에요. 실험을 켜려면 id와 variants를 채워요(예: ["control", "b"]).
  experiment: { id: "none", variants: [] as string[] },
  posthogKey: (import.meta.env.VITE_POSTHOG_KEY as string | undefined) ?? "",
  posthogHost: ((import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://us.i.posthog.com").replace(/\/$/, ""),
  // production / staging 등. PostHog에서 환경별로 걸러 보기 위한 값이에요.
  environment: (import.meta.env.VITE_ANALYTICS_ENV as string | undefined) ?? (import.meta.env.PROD ? "production" : "development"),
  allowInDevelopment: import.meta.env.VITE_ANALYTICS_IN_DEV === "true",
  // 운영자가 정해서 채워요. 비어 있으면 화면에 "운영자가 안내해요"라고만 보여주고 거짓 값을 쓰지 않아요.
  privacyContact: (import.meta.env.VITE_PRIVACY_CONTACT as string | undefined) ?? "",
  retentionDays: (import.meta.env.VITE_DATA_RETENTION_DAYS as string | undefined) ?? "",
};
