// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureAnalyticsForTests, resetAnalyticsForTests } from "./analytics";
import { writeConsent } from "./consent";
import { resetDeviceForTests } from "./device";
import { detailsCompleted, errorCodeOf, flowAbandoned, flowError, flowStarted, meetingConfirmed, newRun, participantsConfigured, recommendationRegenerated, recommendationSelected, recommendationsViewed } from "./flow";
import { ApiError } from "./api";

let events: Array<{ name: string; props: Record<string, any> }> = [];
let summaries: Array<Record<string, any>> = [];
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); resetDeviceForTests(); events = []; summaries = [];
  configureAnalyticsForTests({ key: "phc_test", enabledInDevelopment: true, transport: (_url, body) => { const parsed = JSON.parse(body); events.push({ name: parsed.event, props: parsed.properties }); } });
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => { summaries.push(JSON.parse(String(init?.body))); return new Response(null, { status: 204 }); }));
  writeConsent(true);
  newRun();
});
afterEach(() => { resetAnalyticsForTests(); vi.unstubAllGlobals(); });
const names = () => events.map((event) => event.name);

describe("funnel events", () => {
  it("fires each step once, in order, even when the UI re-renders or repeats an action", () => {
    flowStarted("guided"); flowStarted("typed");
    participantsConfigured(4); participantsConfigured(5);
    detailsCompleted("mixed"); detailsCompleted("guided");
    recommendationsViewed(3, "a,b,c", 900); recommendationsViewed(3, "a,b,c", 900);
    recommendationSelected(1);
    meetingConfirmed(); meetingConfirmed();
    expect(names()).toEqual(["meeting_flow_started", "participants_configured", "meeting_details_completed", "recommendations_viewed", "recommendation_selected", "meeting_confirmed"]);
    expect(events[0].props.start_method).toBe("guided");
    expect(events[1].props.participant_count_bucket).toBe("4-10");
    expect(events[4].props).toMatchObject({ recommendation_rank: 1, is_first_recommendation: true });
    expect(events[5].props.step_count).toBeGreaterThanOrEqual(4);
  });

  it("counts regenerations and a new candidate set separately", () => {
    flowStarted("guided");
    recommendationsViewed(3, "a,b,c", 500);
    recommendationRegenerated("refresh");
    recommendationRegenerated("refresh");
    recommendationsViewed(2, "d,e", 700);
    expect(events.filter((event) => event.name === "recommendation_regenerated").map((event) => event.props.regenerate_count)).toEqual([1, 2]);
    expect(events.filter((event) => event.name === "recommendations_viewed")).toHaveLength(2);
  });

  it("records an abandonment only for a started, unconfirmed run, once, and posts a run summary", async () => {
    flowAbandoned("page_hidden"); // 시작 전에는 이탈이 아니에요
    expect(names()).toEqual([]);
    flowStarted("typed");
    flowAbandoned("restart"); flowAbandoned("page_hidden");
    expect(names()).toEqual(["meeting_flow_started", "flow_abandoned"]);
    expect(events[1].props).toMatchObject({ abandon_reason: "restart", step_name: "conditions" });
    await Promise.resolve();
    expect(summaries[0]).toMatchObject({ completed: false, testMode: "fictional_calendar", flowVersion: "flow-1" });
    expect(summaries[0].runId).toMatch(/^[a-f0-9-]{36}$/);
    newRun();
    flowStarted("guided"); meetingConfirmed(); flowAbandoned("page_hidden"); // 확정한 뒤에는 이탈이 아니에요
    expect(names().filter((name) => name === "flow_abandoned")).toHaveLength(1);
  });

  it("sends only safe error codes, never messages", () => {
    flowStarted("guided");
    flowError(new ApiError("서버에 내 이름 김민지가 있어요", 429, "too_many_requests"), "conditions");
    flowError(new ApiError("서버 오류", 500), "search");
    flowError(new Error("TypeError: cannot read property 'email'"), "search");
    expect(events.filter((event) => event.name === "prototype_error").map((event) => event.props.error_code)).toEqual(["too_many_requests", "http_500", "unknown"]);
    expect(JSON.stringify(events)).not.toMatch(/김민지|email|TypeError/);
    expect(errorCodeOf(new ApiError("x", 400, "Bad Code!"))).toBe("http_400");
  });

  it("starts a fresh run id after newRun", async () => {
    flowStarted("guided"); flowAbandoned("restart");
    await Promise.resolve();
    const first = summaries[0].runId;
    newRun(); flowStarted("guided"); flowAbandoned("restart");
    await Promise.resolve();
    expect(summaries[1].runId).not.toBe(first);
  });
});
