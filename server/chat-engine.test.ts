import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";

let base = "";
let cookie = "";
let close = () => {};
let nextInterpretation: Record<string, unknown> = {};
const realFetch = globalThis.fetch;

beforeAll(async () => {
  const { app } = await import("./index.ts");
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/models")) return Promise.resolve(Response.json({ data: [{ id: "llama-3.3-70b-versatile", active: true }] }));
    if (url.endsWith("/chat/completions")) return Promise.resolve(Response.json({ choices: [{ message: { content: JSON.stringify(nextInterpretation) } }] }));
    return realFetch(input, init);
  });
  const res = await fetch(`${base}/api/session/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: "test-key-not-real" }) });
  cookie = res.headers.get("set-cookie")!.split(";")[0];
});
afterAll(() => close());

const chat = async (body: object) => (await (await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body) })).json()) as { assistantMessage: string; answerOnly?: boolean; intent: string; meeting: { durationMinutes?: number } };
const meeting = { title: "t", purpose: "p", durationMinutes: 60, attendees: ["민수", "서연"], requiredAttendees: ["민수"], preferredTime: "afternoon", dateStart: "2099-01-05", dateEnd: "2099-01-09" };
const candidate = { start: "2099-01-06T05:00:00.000Z", requiredAvailable: true, unavailable: [], noResponse: ["서연"], tentative: [], evidence: [{ attendee: "민수", evidence: "calendar_free" }, { attendee: "서연", evidence: "no_response" }] };

describe("chat engine", () => {
  it("answers an explanation from the candidate data sent with the question, not from the model's text", async () => {
    nextInterpretation = { intent: "EXPLAIN_RECOMMENDATION", assistantMessage: "이 시간이 무조건 최고예요!", meetingPatch: {} };
    const result = await chat({ messages: [{ role: "user", content: "왜 이 시간이 좋아?" }], meeting, context: { candidates: [candidate] } });
    expect(result.answerOnly).toBe(true);
    expect(result.intent).toBe("explain_recommendation");
    expect(result.assistantMessage).toContain("필수 참석자 1명의 캘린더에 충돌이 없어요");
    expect(result.assistantMessage).toContain("응답 대기는 1명");
    expect(result.assistantMessage).not.toContain("무조건");
  });

  it("does not confirm a meeting from chat even if the model says it did", async () => {
    nextInterpretation = { intent: "confirm_meeting", assistantMessage: "회의를 확정했어요!", meetingPatch: {} };
    const result = await chat({ messages: [{ role: "user", content: "확정해줘" }], meeting });
    expect(result.answerOnly).toBe(true);
    expect(result.assistantMessage).toContain("직접 승인");
  });

  it("reports changes in its own words and keeps the other conditions", async () => {
    nextInterpretation = { intent: "update_condition", assistantMessage: "AI 문장", meetingPatch: { durationMinutes: 30 } };
    const result = await chat({ messages: [{ role: "user", content: "30분으로 줄여줘" }], meeting });
    expect(result.answerOnly).toBe(false);
    expect(result.meeting.durationMinutes).toBe(30);
    expect(result.assistantMessage).toBe("회의 시간을 60분에서 30분으로 변경했어요. 나머지 조건은 그대로 유지할게요.");
  });

  it("uses the standard sentence when nothing could be tied to a condition", async () => {
    nextInterpretation = { intent: "unknown", assistantMessage: "음...", meetingPatch: {} };
    const result = await chat({ messages: [{ role: "user", content: "ㅁㄴㅇㄹ" }], meeting });
    expect(result.assistantMessage).toContain("회의 조건에 정확히 연결하지 못했어요");
  });
});
