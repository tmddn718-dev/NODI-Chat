// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureAnalyticsForTests, EVENT_PROPERTIES, getSafeAnalyticsContext, initializeAnalyticsAfterConsent, isAnalyticsEnabled, resetAnalyticsForTests, sanitize, trackAnalyticsEvent, updateAnalyticsConsent, withdrawAnalyticsConsent } from "./analytics";
import { anonymousId, cleanupLegacyAnalyticsStorage, readConsent, writeConsent } from "./consent";
import { deviceCategory, resetDeviceForTests, viewportBucket } from "./device";
import { experimentVariant } from "./experiment";
import { PROTOTYPE } from "./prototype";

type Sent = { url: string; body: { api_key: string; events: Array<Record<string, any>> } };
let sent: Sent[] = [];
const eventsSent = () => sent.flatMap((request) => request.body.events);
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ampKeys = () => Object.keys(localStorage).filter((key) => /^amp_/i.test(key));

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); resetDeviceForTests(); sent = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ code: 200, events_ingested: 1, payload_size_bytes: 1, server_upload_time: 1 }), { status: 200 });
  }));
  configureAnalyticsForTests({ apiKey: "test_project_key_0001", enabledInDevelopment: true, serverUrl: "http://amplitude.test/2/httpapi" });
});
afterEach(async () => { await resetAnalyticsForTests(); vi.unstubAllGlobals(); });

describe("consent gating (real Amplitude SDK 2.48.1)", () => {
  it("does not load or initialize the SDK, send anything, or create identifiers before consent", async () => {
    const load = vi.fn();
    configureAnalyticsForTests({ apiKey: "test_project_key_0001", enabledInDevelopment: true, load });
    expect(isAnalyticsEnabled()).toBe(false);
    expect(await initializeAnalyticsAfterConsent()).toBe(false);
    expect(trackAnalyticsEvent("meeting_flow_started", { start_method: "choice" })).toBe(false);
    expect(load).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
    expect(anonymousId()).toBeNull();
    expect(ampKeys()).toEqual([]);
  });

  it("keeps everything off after a denial, and sends nothing (the denial itself is local only)", async () => {
    const load = vi.fn();
    configureAnalyticsForTests({ apiKey: "test_project_key_0001", enabledInDevelopment: true, load });
    expect(await updateAnalyticsConsent(false)).toBe(false);
    expect(readConsent()?.analytics).toBe(false);
    expect(trackAnalyticsEvent("meeting_flow_started", { start_method: "choice" })).toBe(false);
    await wait(100);
    expect(load).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
    expect(localStorage.getItem("nodi_anon_id")).toBeNull();
  });

  it("initializes once on consent and sends the acceptance event first, with only defined properties", async () => {
    let initCalls = 0;
    configureAnalyticsForTests({ apiKey: "test_project_key_0001", enabledInDevelopment: true, serverUrl: "http://amplitude.test/2/httpapi", load: async () => {
      const real = await import("@amplitude/analytics-browser");
      return { ...real, init: (...args: Parameters<typeof real.init>) => { initCalls += 1; return real.init(...args); } } as typeof real;
    } });
    expect(await updateAnalyticsConsent(true)).toBe(true);
    await initializeAnalyticsAfterConsent(); // 두 번째 호출은 새로 초기화하지 않아요
    trackAnalyticsEvent("meeting_flow_started", { start_method: "natural_language" }, { step: "conditions" });
    await wait(900);
    expect(initCalls).toBe(1);
    const events = eventsSent();
    expect(events.map((event) => event.event_type)).toEqual(["analytics_consent_accepted", "meeting_flow_started"]);
    expect(sent[0].url).toBe("http://amplitude.test/2/httpapi");
    expect(sent[0].body.api_key).toBe("test_project_key_0001");
    for (const event of events) {
      expect(event.user_id ?? null).toBeNull(); // 사용자 ID를 설정하지 않아요
      expect(event.device_id).toMatch(/^[a-f0-9-]{36}/); // Amplitude가 만든 익명 Device ID
      expect(event).not.toHaveProperty("ip"); // IP를 이벤트에 싣지 않아요
      expect(event).not.toHaveProperty("language");
      expect(event.event_type.startsWith("[Amplitude]")).toBe(false); // 자동 추적 이벤트가 없어요
      expect(event.user_properties ?? {}).toEqual({}); // identify·사용자 속성 없음
    }
    const props = events[1].event_properties;
    expect(props).toMatchObject({ environment: "development", flow_version: "flow-1", experiment_id: "none", experiment_variant: "none", test_mode: "fictional_calendar", step_name: "conditions", start_method: "natural_language" });
    expect(props.anonymous_session_id).toMatch(/^[a-f0-9-]{36}$/);
    expect(props.anonymous_session_id).not.toBe(events[1].device_id); // 두 식별자의 역할은 달라요
  }, 15000);

  it("turns every automatic tracking feature off and disables IP, remote config and diagnostics", async () => {
    let options: Record<string, any> = {};
    let userIdArg: unknown = "unset";
    configureAnalyticsForTests({ apiKey: "test_project_key_0001", enabledInDevelopment: true, serverUrl: "http://amplitude.test/2/httpapi", load: async () => {
      const real = await import("@amplitude/analytics-browser");
      return { ...real, init: (key: string, userId: unknown, opts: Record<string, any>) => { userIdArg = userId; options = opts; return real.init(key, undefined, opts); } } as typeof real;
    } });
    await updateAnalyticsConsent(true);
    expect(userIdArg).toBeUndefined();
    expect(options.autocapture).toEqual({ attribution: false, fileDownloads: false, formInteractions: false, pageViews: false, sessions: false, elementInteractions: false, frustrationInteractions: false, networkTracking: false, webVitals: false, performanceTracking: false, pageUrlEnrichment: false });
    expect(options).toMatchObject({ identityStorage: "localStorage", trackingOptions: { ipAddress: false, language: false }, remoteConfig: { fetchRemoteConfig: false }, enableDiagnostics: false, optOut: false, serverZone: "US" });
    expect(options).not.toHaveProperty("userId");
    expect(Object.values(options.autocapture).every((value) => value === false)).toBe(true);
  }, 15000);
});

describe("withdrawal", () => {
  it("stops tracking immediately, drops events queued at that moment, clears identifiers, and starts fresh on re-consent", async () => {
    await updateAnalyticsConsent(true);
    await wait(900);
    const firstDevice = eventsSent()[0].device_id as string;
    const firstAnon = anonymousId();
    const before = eventsSent().length;
    trackAnalyticsEvent("meeting_flow_started", { start_method: "choice" }, { step: "conditions" });
    trackAnalyticsEvent("recommendations_requested", { request_index: 1 }, { step: "search" });
    withdrawAnalyticsConsent(); // 같은 순간에 대기열에 있던 이벤트도 철회 후에는 나가지 않아요
    expect(trackAnalyticsEvent("recommendations_requested", { request_index: 2 })).toBe(false);
    await wait(1800);
    expect(eventsSent().length).toBe(before);
    expect(readConsent()?.analytics).toBe(false);
    expect(anonymousId()).toBeNull();
    expect(ampKeys()).toEqual([]); // Amplitude가 저장한 Device ID·미전송 큐도 지워요
    // 같은 페이지에서 다시 동의하면 새 Device ID와 새 익명 세션 ID로 시작해요
    await updateAnalyticsConsent(true);
    await wait(900);
    const last = eventsSent().at(-1)!;
    expect(last.event_type).toBe("analytics_consent_accepted");
    expect(last.device_id).not.toBe(firstDevice);
    expect(anonymousId()).not.toBe(firstAnon);
  }, 20000);
});

describe("when analytics cannot run", () => {
  it("stays off without a project key, and the app is unaffected", async () => {
    writeConsent(true);
    configureAnalyticsForTests({ apiKey: "", enabledInDevelopment: true });
    expect(isAnalyticsEnabled()).toBe(false);
    expect(await initializeAnalyticsAfterConsent()).toBe(false);
    expect(trackAnalyticsEvent("meeting_flow_started", { start_method: "choice" })).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("stays off in development builds unless explicitly allowed", async () => {
    writeConsent(true);
    configureAnalyticsForTests({ apiKey: "test_project_key_0001", enabledInDevelopment: false });
    expect(isAnalyticsEnabled()).toBe(false);
    expect(await initializeAnalyticsAfterConsent()).toBe(false);
  });

  it("survives an SDK that fails to load", async () => {
    configureAnalyticsForTests({ apiKey: "test_project_key_0001", enabledInDevelopment: true, load: async () => { throw new Error("blocked by an ad blocker"); } });
    expect(await updateAnalyticsConsent(true)).toBe(false);
    expect(trackAnalyticsEvent("meeting_flow_started", { start_method: "choice" })).toBe(false);
  });
});

describe("event dictionary and payload safety", () => {
  it("drops unknown keys and anything that is not a short code, so text can never leak", () => {
    expect(sanitize("recommendation_selected", { recommendation_rank: 1, is_first_recommendation: true, name: "김민지", email: "a@b.co", note: "회의 내용 원문" })).toEqual({ recommendation_rank: 1, is_first_recommendation: true });
    expect(sanitize("prototype_error", { error_code: "이름이 들어간 오류 문장", recoverable: true })).toEqual({ recoverable: true });
    expect(sanitize("prototype_error", { error_code: "too_many_requests", recoverable: true })).toEqual({ error_code: "too_many_requests", recoverable: true });
    expect(sanitize("feedback_submitted", { feedback_score: 4, ease_score: 5, feedback_tags: ["too_slow", "자유 입력 태그"], comment: "원문" })).toEqual({ feedback_score: 4, ease_score: 5 });
    expect(sanitize("feedback_submitted", { feedback_score: 4, ease_score: 5, feedback_tags: ["too_slow", "input_hard"] }).feedback_tags).toEqual(["too_slow", "input_hard"]);
  });

  it("never defines a property that could hold free text, personal data or a user identifier", () => {
    for (const properties of Object.values(EVENT_PROPERTIES)) for (const key of Object.keys(properties)) expect(key).not.toMatch(/(^|_)(comment|message|text|email|phone|user_id|stack|url|ip)($|_)|_name$/);
  });

  it("defines exactly the events of the dictionary", () => {
    expect(Object.keys(EVENT_PROPERTIES).sort()).toEqual(["analytics_consent_accepted", "feedback_opened", "feedback_submitted", "flow_abandoned", "meeting_confirmed", "meeting_details_completed", "meeting_flow_started", "participants_configured", "prototype_error", "prototype_viewed", "recommendation_regenerated", "recommendation_selected", "recommendations_requested", "recommendations_viewed"]);
  });

  it("builds a common context with the same keys and types, and no personal identifiers", () => {
    writeConsent(true);
    const context = getSafeAnalyticsContext("search") as Record<string, unknown>;
    expect(Object.keys(context).sort()).toEqual(["anonymous_session_id", "app_version", "device_category", "environment", "experiment_id", "experiment_variant", "flow_version", "locale", "step_name", "test_mode", "viewport_bucket"]);
    expect(context).toMatchObject({ test_mode: "fictional_calendar", environment: "development", step_name: "search" });
    expect(Object.keys(context)).not.toContain("user_id");
  });
});

describe("device, version and experiment attributes", () => {
  it("classifies devices by the responsive breakpoints and fixes the value for the session", () => {
    expect([deviceCategory(375), deviceCategory(767), deviceCategory(768), deviceCategory(1199), deviceCategory(1200)]).toEqual(["mobile", "mobile", "tablet", "tablet", "desktop"]);
    expect([viewportBucket(320), viewportBucket(479), viewportBucket(480), viewportBucket(1023), viewportBucket(1024), viewportBucket(1920)]).toEqual(["small", "small", "medium", "medium", "large", "large"]);
    writeConsent(true);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const first = getSafeAnalyticsContext();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1400 }); // 화면을 돌리거나 키워도
    const second = getSafeAnalyticsContext();
    expect(first.device_category).toBe("mobile");
    expect(second.device_category).toBe("mobile");
    expect(second.anonymous_session_id).toBe(first.anonymous_session_id);
  });

  it("assigns the same variant to the same id, only known variant names, and none without an experiment", () => {
    const experiment = { id: "recommendation-copy", variants: ["control", "variant_a"] as const };
    expect(experimentVariant("0b8d7f12-3c4e-4a55-9a1b-2f6c1d9e8a77", experiment)).toBe(experimentVariant("0b8d7f12-3c4e-4a55-9a1b-2f6c1d9e8a77", experiment));
    expect(new Set(Array.from({ length: 50 }, (_, i) => experimentVariant(`id-${i}`, experiment)))).toEqual(new Set(["control", "variant_a"]));
    expect(experimentVariant("anything", { id: "none", variants: [] })).toBe("none");
    expect(PROTOTYPE.experiment).toEqual({ id: "none", variants: [] });
  });
});

describe("legacy analytics storage", () => {
  it("removes PostHog leftovers and an old-policy consent so the new analytics tool asks again", () => {
    localStorage.setItem("ph_phc_old_posthog", "{}");
    localStorage.setItem("nodi_consent", JSON.stringify({ policyVersion: "2026-11-01", analytics: true, replay: false, decidedAt: "x" }));
    localStorage.setItem("nodi_anon_id", "0b8d7f12-3c4e-4a55-9a1b-2f6c1d9e8a77");
    document.cookie = "ph_phc_old_posthog=1; path=/";
    cleanupLegacyAnalyticsStorage();
    expect(localStorage.getItem("ph_phc_old_posthog")).toBeNull();
    expect(localStorage.getItem("nodi_consent")).toBeNull();
    expect(localStorage.getItem("nodi_anon_id")).toBeNull();
    expect(document.cookie).not.toContain("ph_phc_old_posthog");
    expect(readConsent()).toBeNull();
  });

  it("keeps a current-policy decision", () => {
    writeConsent(true);
    const id = anonymousId();
    cleanupLegacyAnalyticsStorage();
    expect(readConsent()?.analytics).toBe(true);
    expect(anonymousId()).toBe(id);
  });
});
