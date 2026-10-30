// 공개 프로토타입(NODI_MODE=public)의 서버 설정. 값은 환경변수에서만 읽고, 코드에 흩뿌리지 않아요.
// 비밀값(GROQ_API_KEY 등)은 여기서 읽지 않아요: 사용하는 곳에서 환경변수로만 읽고 로그에 남기지 않아요.
export type PublicConfig = {
  publicDemoEnabled: boolean;
  rateLimitPerMinute: number;
  rateLimitPerDayPerSession: number;
  rateLimitPerDayPerIp: number;
  maxInputChars: number;
  maxConversationTurns: number;
  groqMaxOutputTokens: number;
  groqRequestTimeoutMs: number;
  dailyGlobalRequestBudget: number;
  maxConcurrentAiRequests: number;
  groqModel: string;
  allowedOrigins: string[];
};

// 범위를 벗어나거나 숫자가 아니면 기본값을 써요(잘못된 설정이 한도를 무제한으로 풀지 못하게).
function intOf(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number(value);
  return value !== undefined && value.trim() !== "" && Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): PublicConfig {
  return {
    publicDemoEnabled: env.PUBLIC_DEMO_ENABLED?.trim().toLowerCase() !== "false",
    rateLimitPerMinute: intOf(env.RATE_LIMIT_PER_MINUTE, 10, 1, 600),
    rateLimitPerDayPerSession: intOf(env.RATE_LIMIT_PER_DAY_PER_SESSION, 60, 1, 10_000),
    rateLimitPerDayPerIp: intOf(env.RATE_LIMIT_PER_DAY_PER_IP, 120, 1, 100_000),
    maxInputChars: intOf(env.MAX_INPUT_CHARS, 500, 20, 4000),
    maxConversationTurns: intOf(env.MAX_CONVERSATION_TURNS, 12, 1, 50),
    groqMaxOutputTokens: intOf(env.GROQ_MAX_OUTPUT_TOKENS, 600, 100, 2000),
    groqRequestTimeoutMs: intOf(env.GROQ_REQUEST_TIMEOUT_MS, 15_000, 2000, 60_000),
    dailyGlobalRequestBudget: intOf(env.DAILY_GLOBAL_REQUEST_BUDGET, 1500, 1, 1_000_000),
    maxConcurrentAiRequests: intOf(env.MAX_CONCURRENT_AI_REQUESTS, 4, 1, 50),
    groqModel: /^[A-Za-z0-9._:/-]{1,100}$/.test(env.GROQ_MODEL ?? "") ? env.GROQ_MODEL! : "llama-3.3-70b-versatile",
    allowedOrigins: (env.ALLOWED_ORIGINS ?? env.NODI_PUBLIC_URL ?? "").split(",").map((item) => item.trim().replace(/\/$/, "")).filter(Boolean),
  };
}

let cached: PublicConfig | undefined;
export const getConfig = () => (cached ??= loadConfig());
export const resetConfigForTests = () => { cached = undefined; };
