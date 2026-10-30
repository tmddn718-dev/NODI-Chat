// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { configureAnalyticsForTests, resetAnalyticsForTests } from "./analytics";
import { resetDeviceForTests } from "./device";
import { detailsCompleted, errorCodeOf, flowAbandoned, flowError, flowStarted, meetingConfirmed, newRun, participantsConfigured, recommendationRegenerated, recommendationSelected, recommendationsRequested, recommendationsViewed } from "./flow";
import { updateAnalyticsConsent } from "./analytics";

// 가짜 SDK: 이벤트가 정확한 시점에 한 번씩 나가는지만 빠르게 확인해요(실제 SDK 동작은 analytics.test.ts가 검증해요).
let events: Array<{ name: string; props: Record<string, any> }> = [];
let summaries: Array<Record<string, any>> = [];
const fakeSdk = () => ({
  init: () => ({ promise: Promise.resolve() }),
  add: () => ({ promise: Promise.resolve() }),
  setOptOut: () => undefined,
  reset: () => undefined,
  track: (name: string, props: Record<string, any>) => { events.push({ name, props }); },
  Types: { LogLevel: { None: 0, Warn: 2 } },
}) as never;
const names = () => events.map((event) => event.name);

beforeEach(async () => {
  localStorage.clear(); sessionStorage.clear(); resetDeviceForTests(); events = []; summaries = [];
  configureAnalyticsForTests({ apiKey: "test_key", enabledInDevelopment: true, load: async () => fakeSdk() });
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => { summaries.push(JSON.parse(String(init?.body))); return new Response(null, { status: 204 }); }));
  await updateAnalyticsConsent(true);
  events = []; // 동의 이벤트는 비우고 시작
  newRun();
});
afterEach(async () => { await resetAnalyticsForTests(); vi.unstubAllGlobals(); });

describe("funnel events", () => {
  it("fires each step once, in order, even when the UI re-renders or repeats an action", () => {
    flowStarted("choice"); flowStarted("natural_language");
    participantsConfigured(4); participantsConfigured(5);
    detailsCompleted("natural_language"); detailsCompleted("choice");
    recommendationsRequested();
    recommendationsViewed(3, "a,b,c", 900); recommendationsViewed(3, "a,b,c", 900);
    recommendationSelected(1);
    meetingConfirmed(); meetingConfirmed();
    // 참석자가 먼저 정해져도 퍼널 순서(정보 → 참석자)대로 나가요
    expect(names()).toEqual(["meeting_flow_started", "meeting_details_completed", "participants_configured", "recommendations_requested", "recommendations_viewed", "recommendation_selected", "meeting_confirmed"]);
    expect(events[0].props.start_method).toBe("choice");
    expect(events[1].props.input_method).toBe("natural_language");
    expect(events[2].props.participant_count_bucket).toBe("4-10");
    expect(events[3].props.request_index).toBe(1);
    expect(events[4].props).toMatchObject({ recommendation_count: 3, elapsed_ms: 900 });
    expect(events[5].props).toMatchObject({ recommendation_rank: 1, is_first_recommendation: true });
    expect(events[6].props).toMatchObject({ regeneration_count: 0 });
    expect(typeof events[6].props.total_elapsed_ms).toBe("number");
  });

  it("keeps the funnel order when details come first, and waits for details when participants come first", () => {
    flowStarted("choice");
    detailsCompleted("choice");
    participantsConfigured(2);
    expect(names()).toEqual(["meeting_flow_started", "meeting_details_completed", "participants_configured"]);
    expect(events[2].props.participant_count_bucket).toBe("2-3");
    newRun(); events = [];
    flowStarted("choice");
    participantsConfigured(3); // 아직 회의 정보가 없으면 보류
    expect(names()).toEqual(["meeting_flow_started"]);
    detailsCompleted("choice"); // 정보가 정해지면 정보 → 참석자 순서로 한꺼번에
    expect(names()).toEqual(["meeting_flow_started", "meeting_details_completed", "participants_configured"]);
  });

  it("numbers each recommendation request and counts a regeneration only when it succeeded", () => {
    flowStarted("choice");
    recommendationsRequested();
    recommendationsViewed(3, "a,b,c", 500);
    recommendationsRequested(); // 두 번째 요청이 제출됨
    recommendationsRequested(); // 실패하면 다시 제출
    recommendationRegenerated("refresh"); // 성공했을 때만 호출돼요
    recommendationsViewed(2, "d,e", 700);
    expect(events.filter((event) => event.name === "recommendations_requested").map((event) => event.props.request_index)).toEqual([1, 2, 3]);
    expect(events.filter((event) => event.name === "recommendation_regenerated").map((event) => [event.props.regeneration_count, event.props.reason_category])).toEqual([[1, "refresh"]]);
    expect(events.filter((event) => event.name === "recommendations_viewed")).toHaveLength(2);
    meetingConfirmed();
    expect(events.at(-1)!.props.regeneration_count).toBe(1);
  });

  it("records an abandonment only for a started, unconfirmed run, once, with the last completed step", async () => {
    flowAbandoned("page_hidden"); // 시작 전에는 이탈이 아니에요
    expect(names()).toEqual([]);
    flowStarted("choice");
    detailsCompleted("choice");
    flowAbandoned("restart"); flowAbandoned("page_hidden");
    expect(names()).toEqual(["meeting_flow_started", "meeting_details_completed", "flow_abandoned"]);
    expect(events[2].props).toMatchObject({ last_completed_step: "conditions", abandon_reason: "restart", step_name: "participants" });
    await Promise.resolve();
    expect(summaries[0]).toMatchObject({ completed: false, testMode: "fictional_calendar", flowVersion: "flow-1" });
    expect(summaries[0].runId).toMatch(/^[a-f0-9-]{36}$/);
    newRun();
    flowStarted("choice"); meetingConfirmed(); flowAbandoned("page_hidden"); // 확정한 뒤에는 이탈이 아니에요
    expect(names().filter((name) => name === "flow_abandoned")).toHaveLength(1);
  });

  it("sends only safe error codes with a recoverable flag, never messages", () => {
    flowStarted("choice");
    flowError(new ApiError("서버에 내 이름 김민지가 있어요", 429, "too_many_requests"), "conditions");
    flowError(new ApiError("점검 중", 503, "demo_disabled"), "search");
    flowError(new ApiError("서버 오류", 500), "search");
    flowError(new Error("TypeError: cannot read property 'email'"), "search");
    const errors = events.filter((event) => event.name === "prototype_error");
    expect(errors.map((event) => [event.props.error_code, event.props.recoverable])).toEqual([["too_many_requests", true], ["demo_disabled", false], ["http_500", true], ["unknown", true]]);
    expect(errors[0].props.step_name).toBe("conditions");
    expect(JSON.stringify(events)).not.toMatch(/김민지|email|TypeError/);
    expect(errorCodeOf(new ApiError("x", 400, "Bad Code!"))).toBe("http_400");
  });

  it("keeps the run id (for the server's results store) out of every Amplitude event", async () => {
    flowStarted("choice"); meetingConfirmed();
    await Promise.resolve();
    expect(summaries[0].runId).toMatch(/^[a-f0-9-]{36}$/);
    expect(JSON.stringify(events)).not.toContain(summaries[0].runId);
    expect(JSON.stringify(events)).not.toMatch(/run_id|runId/);
  });

  it("starts a fresh run id after newRun", async () => {
    flowStarted("choice"); flowAbandoned("restart");
    await Promise.resolve();
    const first = summaries[0].runId;
    newRun(); flowStarted("choice"); flowAbandoned("restart");
    await Promise.resolve();
    expect(summaries[1].runId).not.toBe(first);
  });
});
