import { anonymousId, readConsent, writeConsent } from "./consent";
import { deviceInfo } from "./device";
import { experimentVariant } from "./experiment";
import { PROTOTYPE } from "./prototype";

// Amplitude Browser SDK 2 중앙 모듈. 분석 코드는 모두 이 파일을 거쳐요.
//  · 동의하기 전에는 SDK를 불러오지도, 초기화하지도, 이벤트를 보내지도 않아요(동적 import로 동의 후에만 코드를 받아요).
//  · 자동 추적(페이지뷰·폼·파일·클릭·세션·어트리뷰션·웹 바이탈·네트워크)은 전부 명시적으로 꺼요. 아래 사전의 이벤트만 보내요.
//  · user_id는 절대 설정하지 않고 identify도 쓰지 않아요(사용자 프로필을 만들지 않아요). Session Replay 플러그인은 설치하지 않았어요.
//  · 이벤트 이름과 속성은 타입(EventMap)으로 강제하고, 실행 시에도 허용 목록·코드형 값만 통과시켜요.
//  사용한 SDK: @amplitude/analytics-browser 2.48.1(정확한 버전으로 고정)

export type StepName = "consent" | "conditions" | "participants" | "search" | "recommendations" | "confirm" | "feedback" | "done";
export type CompletedStep = "start" | "conditions" | "participants" | "search" | "recommendations" | "confirm";
export type InputMethod = "choice" | "natural_language";
export type CountBucket = "1" | "2-3" | "4-10" | "11-30" | "31plus";
export type FeedbackTag = "input_hard" | "participants_hard" | "recommendation_unclear" | "confirm_unclear" | "too_slow" | "mobile_hard" | "other";
export type RegenerationReason = "refresh" | "conditions_changed" | "no_candidates";

// 이벤트 사전: 이름 → 허용 속성(타입). 새 이벤트·속성은 여기와 EVENT_PROPERTIES에 함께 추가해야 컴파일돼요.
export interface EventMap {
  prototype_viewed: { entry_context: "direct" | "internal" | "external" };
  analytics_consent_accepted: { consent_policy_version: string };
  meeting_flow_started: { start_method: InputMethod };
  meeting_details_completed: { input_method: InputMethod; elapsed_ms: number };
  participants_configured: { participant_count_bucket: CountBucket; elapsed_ms: number };
  recommendations_requested: { request_index: number };
  recommendations_viewed: { recommendation_count: number; elapsed_ms: number };
  recommendation_selected: { recommendation_rank: number; is_first_recommendation: boolean };
  recommendation_regenerated: { regeneration_count: number; reason_category: RegenerationReason };
  meeting_confirmed: { total_elapsed_ms: number; regeneration_count: number };
  flow_abandoned: { last_completed_step: CompletedStep; elapsed_ms: number; abandon_reason: "restart" | "page_hidden" };
  prototype_error: { error_code: string; recoverable: boolean };
  feedback_opened: { flow_completed: boolean };
  feedback_submitted: { feedback_score: number; ease_score: number; feedback_tags: FeedbackTag[] };
}
export type EventName = keyof EventMap;
// 모든 이벤트의 모든 속성이 여기 적혀 있어야 컴파일돼요(누락 방지). 실행 시 허용 목록으로도 써요.
export const EVENT_PROPERTIES: { [K in EventName]: { [P in keyof EventMap[K]]-?: true } } = {
  prototype_viewed: { entry_context: true },
  analytics_consent_accepted: { consent_policy_version: true },
  meeting_flow_started: { start_method: true },
  meeting_details_completed: { input_method: true, elapsed_ms: true },
  participants_configured: { participant_count_bucket: true, elapsed_ms: true },
  recommendations_requested: { request_index: true },
  recommendations_viewed: { recommendation_count: true, elapsed_ms: true },
  recommendation_selected: { recommendation_rank: true, is_first_recommendation: true },
  recommendation_regenerated: { regeneration_count: true, reason_category: true },
  meeting_confirmed: { total_elapsed_ms: true, regeneration_count: true },
  flow_abandoned: { last_completed_step: true, elapsed_ms: true, abandon_reason: true },
  prototype_error: { error_code: true, recoverable: true },
  feedback_opened: { flow_completed: true },
  feedback_submitted: { feedback_score: true, ease_score: true, feedback_tags: true },
};

type Scalar = string | number | boolean;
const TOKEN = /^[a-z0-9_.+-]{1,48}$/;
const safeScalar = (value: unknown): value is Scalar => (typeof value === "number" ? Number.isFinite(value) : typeof value === "boolean" || (typeof value === "string" && TOKEN.test(value)));

// 허용 목록에 없는 키와 "짧은 코드형"이 아닌 값(이름·문장 같은 자유 텍스트)은 버려요.
export function sanitize(name: EventName, props: Record<string, unknown>): Record<string, Scalar | Scalar[]> {
  const out: Record<string, Scalar | Scalar[]> = {};
  const allowed = Object.keys(EVENT_PROPERTIES[name]);
  for (const [key, value] of Object.entries(props)) {
    if (!allowed.includes(key) || value === undefined) continue;
    if (Array.isArray(value)) { if (value.length <= 10 && value.every(safeScalar)) out[key] = value as Scalar[]; }
    else if (safeScalar(value)) out[key] = value;
  }
  return out;
}

type Amplitude = typeof import("@amplitude/analytics-browser");
let override: { apiKey?: string; enabledInDevelopment?: boolean; serverUrl?: string; load?: () => Promise<Amplitude> } = {};
let client: Amplitude | null = null;
let initPromise: Promise<boolean> | null = null;
let buffer: Array<{ name: EventName; properties: Record<string, unknown> }> = [];
let withdrawn = false;

export function configureAnalyticsForTests(options: typeof override) { override = options; }
export async function resetAnalyticsForTests() {
  client = null; initPromise = null; buffer = []; withdrawn = false; override = {};
}

const apiKey = () => override.apiKey ?? PROTOTYPE.amplitudeApiKey;
const hasKey = () => apiKey().length > 0;
const allowedHere = () => import.meta.env.PROD || PROTOTYPE.allowInDevelopment || override.enabledInDevelopment === true;

// 키가 있고 · 운영 빌드(또는 명시 허용한 개발 빌드)이고 · 사용자가 동의했고 · 철회하지 않았을 때만 켜져요.
export function isAnalyticsEnabled() {
  return hasKey() && allowedHere() && readConsent()?.analytics === true && !withdrawn;
}

// 동의 후에만 호출해요. SDK를 처음 받아 초기화하고(한 번만), 실패해도 앱 기능은 막지 않아요.
export function initializeAnalyticsAfterConsent(): Promise<boolean> {
  if (!isAnalyticsEnabled()) return Promise.resolve(false);
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const amplitude = await (override.load ?? (() => import("@amplitude/analytics-browser")))();
      const dev = PROTOTYPE.environment === "development";
      const serverUrl = override.serverUrl ?? PROTOTYPE.amplitudeServerUrl;
      await amplitude.init(apiKey(), undefined, {
        serverZone: PROTOTYPE.amplitudeServerZone,
        ...(serverUrl ? { serverUrl } : {}),
        appVersion: PROTOTYPE.appVersion,
        // 자동 추적 전부 OFF(명시적으로 하나씩). sessions를 꺼도 이벤트에는 세션 ID가 붙어서 Amplitude가 세션을 계산해요.
        autocapture: {
          attribution: false, fileDownloads: false, formInteractions: false, pageViews: false, sessions: false,
          elementInteractions: false, frustrationInteractions: false, networkTracking: false, webVitals: false, performanceTracking: false, pageUrlEnrichment: false,
        },
        // 쿠키 대신 localStorage에 익명 Device ID를 저장해요(동의 안내에 밝혀요).
        identityStorage: "localStorage",
        // ip를 이벤트에 싣지 않아요(language는 우리 속성 locale로 대신해요).
        trackingOptions: { ipAddress: false, language: false, platform: true },
        // 원격 설정이 우리가 끈 자동 추적을 다시 켜지 못하게 하고, SDK 진단 전송도 끕니다.
        remoteConfig: { fetchRemoteConfig: false },
        enableDiagnostics: false,
        optOut: false,
        // 이벤트를 바로바로 보내 대기열에 남는 이벤트를 최소화해요(철회 시 남는 이벤트가 거의 없도록).
        flushQueueSize: 1,
        flushIntervalMillis: 200,
        flushMaxRetries: 3,
        useBatch: false,
        logLevel: dev ? amplitude.Types.LogLevel.Warn : amplitude.Types.LogLevel.None,
      }).promise;
      amplitude.setOptOut(false);
      // 안전장치: 이벤트가 처리되는 순간에도 동의 상태를 다시 확인해요. 철회 직전에 대기열로 들어간 이벤트도 철회 후에는 버려져요.
      await amplitude.add({ name: "nodi-consent-gate", type: "before", setup: async () => undefined, execute: async (event) => (isAnalyticsEnabled() ? event : null) }).promise;
      client = amplitude;
      const pending = buffer;
      buffer = [];
      for (const item of pending) send(item.name, item.properties);
      return true;
    } catch {
      initPromise = null;
      buffer = [];
      return false;
    }
  })();
  return initPromise;
}

const localeOf = () => { const l = (typeof navigator === "undefined" ? "ko" : navigator.language).slice(0, 2).toLowerCase(); return l === "ko" || l === "en" ? l : "other"; };

// 이벤트마다 같은 키·타입으로 붙는 공통 문맥(개인정보 없음). anonymous_session_id는 동의 후 만든 무작위 UUID예요(Amplitude Device ID와는 별개).
export function getSafeAnalyticsContext(step?: StepName) {
  const id = anonymousId();
  return {
    anonymous_session_id: id ?? "none",
    environment: PROTOTYPE.environment,
    app_version: PROTOTYPE.appVersion,
    flow_version: PROTOTYPE.flowVersion,
    experiment_id: PROTOTYPE.experiment.id,
    experiment_variant: id ? experimentVariant(id) : "none",
    test_mode: PROTOTYPE.testMode,
    ...deviceInfo(),
    locale: localeOf(),
    ...(step ? { step_name: step } : {}),
  };
}

function send(name: EventName, properties: Record<string, unknown>) {
  try { client?.track(name, properties as Record<string, Scalar | Scalar[]>); } catch { /* 분석 실패가 앱을 멈추지 않아요 */ }
}

export function trackAnalyticsEvent<K extends EventName>(name: K, props: EventMap[K], options: { step?: StepName } = {}): boolean {
  if (!isAnalyticsEnabled()) return false;
  const properties = { ...getSafeAnalyticsContext(options.step), ...sanitize(name, props as Record<string, unknown>) };
  if (client) { send(name, properties); return true; }
  // 초기화가 끝나기 전 이벤트는 잠깐 모았다가 초기화가 성공하면 순서대로 보내요(실패하면 버려요).
  if (initPromise && buffer.length < 50) { buffer.push({ name, properties }); return true; }
  return false;
}

function clearAmplitudeStorage() {
  try { for (const key of Object.keys(localStorage)) if (/^amp_/i.test(key)) localStorage.removeItem(key); } catch { /* 무시 */ }
  try { for (const key of Object.keys(sessionStorage)) if (/^amp_/i.test(key)) sessionStorage.removeItem(key); } catch { /* 무시 */ }
  try {
    for (const part of document.cookie.split(";")) {
      const name = part.split("=")[0]?.trim() ?? "";
      if (/^amp_/i.test(name)) document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  } catch { /* 무시 */ }
}

// 익명 식별 초기화: 앱의 익명 세션 ID와 Amplitude Device ID를 지우고, 다음 동의 때 새로 만들게 해요.
// (Amplitude reset()은 새 Device ID를 곧바로 저장소에 쓰기 때문에, 철회 때는 쓰지 않고 저장값만 지워요.)
export function resetAnalyticsIdentity() {
  try { localStorage.removeItem("nodi_anon_id"); } catch { /* 무시 */ }
  clearAmplitudeStorage();
}

// 동의 선택. 거부는 로컬에만 기록하고 Amplitude에는 아무것도 보내지 않아요.
export async function updateAnalyticsConsent(accepted: boolean) {
  writeConsent(accepted);
  if (!accepted) return false;
  if (client && withdrawn) { withdrawn = false; client.setOptOut(false); client.reset(); } // 같은 페이지에서 철회 후 재동의: 새 Device ID로 시작
  withdrawn = false;
  const started = initializeAnalyticsAfterConsent();
  // 초기화가 성공한 뒤 가장 먼저 나가도록 대기열에 넣어요.
  trackAnalyticsEvent("analytics_consent_accepted", { consent_policy_version: PROTOTYPE.consentPolicyVersion }, { step: "consent" });
  return started;
}

// 철회: 즉시 추적을 멈추고(setOptOut), 대기 중인 이벤트를 버리고, 식별자(앱 익명 ID·Amplitude Device ID)를 지워요.
export function withdrawAnalyticsConsent() {
  withdrawn = true;
  buffer = [];
  try { client?.setOptOut(true); } catch { /* 무시 */ }
  writeConsent(false);
  resetAnalyticsIdentity();
  // SDK가 옵트아웃 상태와 Device ID를 비동기로 한 번 더 저장소에 쓰기 때문에, 그 뒤에 다시 지워서 식별자가 남지 않게 해요.
  for (const delay of [250, 1500]) setTimeout(() => { if (withdrawn) clearAmplitudeStorage(); }, delay);
  // 같은 페이지에서 다시 동의하면(updateAnalyticsConsent) 새 Device ID로 시작해요.
}
