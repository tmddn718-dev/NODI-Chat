// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { capture, configureAnalyticsForTests, resetAnalyticsForTests, sanitize, SCHEMA } from "./analytics";
import { anonymousId, readConsent, writeConsent } from "./consent";
import { deviceCategory, resetDeviceForTests, viewportBucket } from "./device";
import { experimentVariant } from "./experiment";
import { PROTOTYPE } from "./prototype";

let sent: Array<{ url: string; body: Record<string, any> }> = [];
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetDeviceForTests();
  sent = [];
  configureAnalyticsForTests({ key: "phc_test_public_key", host: "https://eu.i.posthog.com/", enabledInDevelopment: true, transport: (url, body) => sent.push({ url, body: JSON.parse(body) }) });
});
afterEach(() => resetAnalyticsForTests());

describe("consent gating", () => {
  it("sends nothing and creates no anonymous id before consent, or after a denial", () => {
    expect(capture("meeting_flow_started", { start_method: "guided" })).toBe(false);
    expect(anonymousId()).toBeNull();
    writeConsent(false);
    expect(capture("meeting_flow_started", { start_method: "guided" })).toBe(false);
    expect(localStorage.getItem("nodi_anon_id")).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it("sends after consent, then stops and forgets the id on withdrawal (with one final status event)", () => {
    writeConsent(true);
    expect(capture("meeting_flow_started", { start_method: "typed" }, { step: "conditions" })).toBe(true);
    const id = anonymousId();
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    expect(sent[0].url).toBe("https://eu.i.posthog.com/capture/");
    capture("analytics_consent_updated", { consent_status: "withdrawn", policy_version: PROTOTYPE.consentPolicyVersion }, { force: true });
    expect(sent).toHaveLength(2);
    writeConsent(false);
    expect(anonymousId()).toBeNull();
    expect(capture("meeting_confirmed", { total_ms: 1 })).toBe(false);
    expect(sent).toHaveLength(2);
    writeConsent(true);
    expect(anonymousId()).not.toBe(id); // 다시 동의하면 새 ID — 이전 기록과 이어지지 않아요
  });

  it("asks again when the policy version changes", () => {
    writeConsent(true);
    const stored = JSON.parse(localStorage.getItem("nodi_consent")!);
    localStorage.setItem("nodi_consent", JSON.stringify({ ...stored, policyVersion: "old" }));
    expect(readConsent()).toBeNull();
  });

  it("stays off without a project key or outside production builds", () => {
    writeConsent(true);
    configureAnalyticsForTests({ key: "", enabledInDevelopment: true, transport: (url, body) => sent.push({ url, body: JSON.parse(body) }) });
    expect(capture("meeting_flow_started", { start_method: "guided" })).toBe(false);
    configureAnalyticsForTests({ key: "phc_x", enabledInDevelopment: false, transport: (url, body) => sent.push({ url, body: JSON.parse(body) }) });
    expect(capture("meeting_flow_started", { start_method: "guided" })).toBe(false);
  });
});

describe("event payloads", () => {
  it("carries the common attributes, an anonymous profile-less flag and no identify", () => {
    writeConsent(true);
    capture("recommendations_viewed", { recommendation_count: 3, generation_ms: 840 }, { step: "recommendations", elapsedMs: 4200.4 });
    const props = sent[0].body.properties;
    expect(sent[0].body).toMatchObject({ api_key: "phc_test_public_key", event: "recommendations_viewed" });
    expect(sent[0].body.distinct_id).toBe(props.anonymous_session_id);
    expect(props).toMatchObject({ app_version: PROTOTYPE.appVersion, flow_version: "flow-1", experiment_id: "none", experiment_variant: "none", test_mode: "fictional_calendar", step_name: "recommendations", elapsed_ms: 4200, recommendation_count: 3, $process_person_profile: false });
    expect(["mobile", "tablet", "desktop"]).toContain(props.device_category);
    expect(props.viewport_bucket).toMatch(/^[a-z0-9_]+$/);
    expect(JSON.stringify(sent[0].body)).not.toMatch(/\$identify|\$set|email|user-agent/i);
  });

  it("drops unknown keys and anything that is not a short code, so text can never leak", () => {
    const dirty = sanitize("recommendation_selected", { recommendation_rank: 1, is_first_recommendation: true, name: "김민지", email: "a@b.co", note: "회의 내용 원문" });
    expect(dirty).toEqual({ recommendation_rank: 1, is_first_recommendation: true });
    expect(sanitize("prototype_error", { error_code: "이름이 들어간 오류 문장" })).toEqual({});
    expect(sanitize("prototype_error", { error_code: "too_many_requests" })).toEqual({ error_code: "too_many_requests" });
    expect(sanitize("feedback_submitted", { overall_score: 4, ease_score: 5, tags: ["too_slow", "자유 입력 태그"], comment: "원문", run_id: "0b8d7f12-3c4e-4a55-9a1b-2f6c1d9e8a77" })).toEqual({ overall_score: 4, ease_score: 5, run_id: "0b8d7f12-3c4e-4a55-9a1b-2f6c1d9e8a77" });
  });

  it("never lets a free-text feedback comment into any event schema", () => {
    for (const keys of Object.values(SCHEMA)) expect((keys as readonly string[]).some((key) => /comment|message|text|name|email/.test(key))).toBe(false);
  });
});

describe("device and experiment attributes", () => {
  it("classifies devices by the responsive breakpoints and fixes the value for the session", () => {
    expect([deviceCategory(375), deviceCategory(767), deviceCategory(768), deviceCategory(1199), deviceCategory(1200)]).toEqual(["mobile", "mobile", "tablet", "tablet", "desktop"]);
    expect([viewportBucket(320), viewportBucket(375), viewportBucket(700), viewportBucket(900), viewportBucket(1100), viewportBucket(1400), viewportBucket(1920)]).toEqual(["lt360", "360_479", "480_767", "768_1023", "1024_1199", "1200_1599", "gte1600"]);
    writeConsent(true);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    capture("prototype_viewed", { entry: "direct" });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1400 }); // 화면을 돌리거나 키워도
    capture("prototype_viewed", { entry: "direct" });
    expect(sent[0].body.properties.device_category).toBe("mobile");
    expect(sent[1].body.properties.device_category).toBe("mobile");
    expect(sent[1].body.properties.anonymous_session_id).toBe(sent[0].body.properties.anonymous_session_id);
  });

  it("assigns the same variant to the same id, and none when no experiment runs", () => {
    const experiment = { id: "recommendation-copy", variants: ["control", "b"] };
    expect(experimentVariant("0b8d7f12-3c4e-4a55-9a1b-2f6c1d9e8a77", experiment)).toBe(experimentVariant("0b8d7f12-3c4e-4a55-9a1b-2f6c1d9e8a77", experiment));
    const seen = new Set(Array.from({ length: 50 }, (_, i) => experimentVariant(`id-${i}`, experiment)));
    expect(seen).toEqual(new Set(["control", "b"]));
    expect(experimentVariant("anything", { id: "none", variants: [] })).toBe("none");
  });
});
