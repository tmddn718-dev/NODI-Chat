import { anonymousId, readConsent } from "./consent";
import { deviceInfo } from "./device";
import { experimentVariant } from "./experiment";
import { PROTOTYPE } from "./prototype";

// 동의한 사용자의 "명시적 익명 이벤트"만 PostHog로 보내요. 자동 캡처·세션 리플레이·identify는 쓰지 않아요.
// 속성은 아래 허용 목록(SCHEMA)에 있는 키만, 짧은 코드형 값(숫자·불리언·영소문자 토큰)만 나가요.
// 그래서 이름·이메일·대화 원문·자유 의견이 실수로 섞여도 전송되지 않아요.
export const SCHEMA = {
  prototype_viewed: ["entry"],
  analytics_consent_updated: ["consent_status", "policy_version"],
  meeting_flow_started: ["start_method"],
  meeting_details_completed: ["input_method"],
  participants_configured: ["participant_count_bucket"],
  recommendations_viewed: ["recommendation_count", "generation_ms"],
  recommendation_selected: ["recommendation_rank", "is_first_recommendation"],
  recommendation_regenerated: ["regenerate_count", "reason"],
  meeting_confirmed: ["total_ms", "step_count"],
  flow_abandoned: ["abandon_reason"],
  prototype_error: ["error_code"],
  feedback_opened: ["completed"],
  feedback_submitted: ["overall_score", "ease_score", "tags", "run_id"],
} as const;

export type EventName = keyof typeof SCHEMA;
export type StepName = "consent" | "conditions" | "participants" | "search" | "recommendations" | "confirm" | "feedback" | "done";
export type Props = Record<string, string | number | boolean | string[] | undefined>;

const TOKEN = /^[a-z0-9_.+-]{1,48}$/;
const safeScalar = (value: unknown) => (typeof value === "number" ? Number.isFinite(value) : typeof value === "boolean" || (typeof value === "string" && TOKEN.test(value)));

// 허용 목록에 없는 키와 코드형이 아닌 값은 버려요(tags는 코드형 문자열 배열만).
export function sanitize(name: EventName, props: Props): Record<string, string | number | boolean | string[]> {
  const out: Record<string, string | number | boolean | string[]> = {};
  const allowed = SCHEMA[name] as readonly string[];
  for (const [key, value] of Object.entries(props)) {
    if (!allowed.includes(key) || value === undefined) continue;
    if (Array.isArray(value)) { if (key === "tags" && value.length <= 10 && value.every(safeScalar)) out[key] = value; }
    else if (safeScalar(value)) out[key] = value;
  }
  return out;
}

type Transport = (url: string, body: string) => void;
const defaultTransport: Transport = (url, body) => {
  // 쿠키 없이(credentials omit) 보내고, 실패해도 사용자 화면에는 영향이 없어요.
  void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "omit" }).catch(() => undefined);
};
let transport: Transport = defaultTransport;
let override: { key?: string; host?: string; enabledInDevelopment?: boolean } = {};
export function configureAnalyticsForTests(options: { transport?: Transport; key?: string; host?: string; enabledInDevelopment?: boolean }) {
  if (options.transport) transport = options.transport;
  override = { key: options.key, host: options.host, enabledInDevelopment: options.enabledInDevelopment };
}
export function resetAnalyticsForTests() { transport = defaultTransport; override = {}; }

const key = () => override.key ?? PROTOTYPE.posthogKey;
const host = () => (override.host ?? PROTOTYPE.posthogHost).replace(/\/$/, "");

// 키가 있고, 동의했고, 운영 빌드(또는 명시적으로 허용한 개발 빌드)일 때만 켜져요. 개발 이벤트가 운영 프로젝트에 섞이지 않게 해요.
export function analyticsEnabled() {
  const allowedHere = import.meta.env.PROD || PROTOTYPE.allowInDevelopment || override.enabledInDevelopment === true;
  return Boolean(key()) && allowedHere && readConsent()?.analytics === true;
}

const localeOf = () => { const l = (typeof navigator === "undefined" ? "ko" : navigator.language).slice(0, 2).toLowerCase(); return l === "ko" || l === "en" ? l : "other"; };

export function commonProps(step?: StepName, elapsedMs?: number) {
  const id = anonymousId();
  return {
    anonymous_session_id: id ?? "none",
    app_version: PROTOTYPE.appVersion,
    flow_version: PROTOTYPE.flowVersion,
    experiment_id: PROTOTYPE.experiment.id,
    experiment_variant: id ? experimentVariant(id) : "none",
    test_mode: PROTOTYPE.testMode,
    environment: PROTOTYPE.environment,
    ...deviceInfo(),
    locale: localeOf(),
    ...(step ? { step_name: step } : {}),
    ...(typeof elapsedMs === "number" && Number.isFinite(elapsedMs) ? { elapsed_ms: Math.max(0, Math.round(elapsedMs)) } : {}),
  };
}

// 동의 철회 이벤트는 철회 직전에 한 번만 보내요(상태와 정책 버전만 담겨요). 이후에는 아무것도 보내지 않아요.
export function capture(name: EventName, props: Props = {}, options: { step?: StepName; elapsedMs?: number; force?: boolean } = {}) {
  if (!options.force && !analyticsEnabled()) return false;
  if (options.force && (!key() || !anonymousId())) return false;
  const common = commonProps(options.step, options.elapsedMs);
  transport(`${host()}/capture/`, JSON.stringify({
    api_key: key(),
    event: name,
    distinct_id: common.anonymous_session_id,
    timestamp: new Date().toISOString(),
    // 사용자 프로필을 만들지 않는 익명 이벤트로 보내요. identify는 호출하지 않아요.
    properties: { ...common, ...sanitize(name, props), $process_person_profile: false, $lib: "nodi-prototype" },
  }));
  return true;
}
