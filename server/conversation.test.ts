import { describe, expect, it } from "vitest";
import { buildReply, compareCandidates, describeChanges, explainCandidate, NOT_UNDERSTOOD_TEXT, normalizeIntent, rsvpStatus, viewOfCandidate, viewOfRow, type CandidateView } from "./conversation.ts";
import type { Candidate, MeetingDraft } from "./types.ts";

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  id: "c1", start: "2026-11-03T05:00:00.000Z", end: "2026-11-03T06:00:00.000Z", available: 3, total: 4, requiredAvailable: true, score: 90, reason: "",
  unavailable: [], unknown: ["지연"], tentative: [], noResponse: ["지연"], calendarFreeCount: 3, manualAvailableCount: 0, conflictCount: 0, unknownCount: 1, acceptedCount: 0,
  checkedAt: "2026-10-30T00:00:00.000Z", basedOnMeetingVersion: 1, basisKey: "k",
  evidence: [{ attendee: "민수", evidence: "calendar_free" }, { attendee: "서연", evidence: "calendar_free" }, { attendee: "지연", evidence: "no_response" }, { attendee: "태오", evidence: "calendar_free" }],
  ...over,
});
const meeting: MeetingDraft = { title: "t", purpose: "p", durationMinutes: 60, attendees: ["민수", "서연", "지연", "태오"], requiredAttendees: ["민수", "서연"], preferredTime: "afternoon" };
const views = (...c: Candidate[]) => c.map((item) => viewOfCandidate(item, meeting.requiredAttendees!));

describe("intents", () => {
  it("accepts spec names, legacy names and unknown values", () => {
    expect(normalizeIntent("EXPLAIN_RECOMMENDATION")).toBe("explain_recommendation");
    expect(normalizeIntent("update_condition")).toBe("update_meeting");
    expect(normalizeIntent("request_recommendation")).toBe("search_availability");
    expect(normalizeIntent("nonsense")).toBe("unknown");
  });
});

describe("describeChanges", () => {
  it("names only what changed and keeps the rest", () => {
    const text = describeChanges({ ...meeting }, { ...meeting, durationMinutes: 30 }, ["durationMinutes"]);
    expect(text).toBe("회의 시간을 60분에서 30분으로 변경했어요. 나머지 조건은 그대로 유지할게요.");
  });
  it("describes attendee and priority changes", () => {
    const next = { ...meeting, attendees: ["민수", "서연", "지연"], requiredAttendees: ["민수"] };
    const text = describeChanges(meeting, next, ["attendees", "requiredAttendees"]);
    expect(text).toContain("태오님을 참석자에서 제외했어요");
    expect(text).toContain("서연님을 선택 참석자로 바꿨어요");
  });
  it("says nothing when nothing changed", () => {
    expect(describeChanges(meeting, meeting, [])).toBe("");
  });
});

describe("explaining recommendations from real data", () => {
  it("states required status, preference, optional status and the remaining uncertainty without inventing", () => {
    const text = explainCandidate(views(candidate()), meeting, "왜 이 시간이 좋아?");
    expect(text).toContain("필수 참석자 2명의 캘린더에 충돌이 없어요");
    expect(text).toContain("요청하신 오후 시간대에 해당해요");
    expect(text).toContain("응답 대기는 1명");
    expect(text).toContain("불참이 아니라 아직 모르는 상태");
    expect(text).toContain("캘린더가 비어 있다는 것이 참석을 수락했다는 뜻은 아니에요");
    expect(text).not.toMatch(/점수|보장|최고|확정했/);
  });
  it("does not explain when there is no evidence, and does not claim a lookup", () => {
    const text = explainCandidate(views(candidate({ evidence: [] })), meeting, "왜?");
    expect(text).toContain("상세 추천 근거를 확인할 수 없어요");
    expect(text).not.toContain("조회했");
  });
  it("answers about the requested ordinal candidate and handles no candidates", () => {
    const second = candidate({ id: "c2", start: "2026-11-04T01:00:00.000Z" });
    expect(explainCandidate(views(candidate(), second), meeting, "두 번째 후보는 왜?")).toContain("2번째 후보");
    expect(explainCandidate([], meeting, "왜?")).toContain("아직 추천한 후보 시간이 없어요");
  });
  it("explains a candidate that fails the required rule without calling it available", () => {
    const text = explainCandidate(views(candidate({ requiredAvailable: false, unavailable: ["민수"] })), meeting, "왜?");
    expect(text).toContain("확정할 수 없는 시간이에요");
  });
});

describe("comparing candidates", () => {
  it("lists differences per candidate and the shared uncertainty", () => {
    const morning = candidate({ id: "c2", start: "2026-11-04T01:00:00.000Z" });
    const text = compareCandidates(views(candidate(), morning), meeting);
    expect(text).toContain("1번 후보");
    expect(text).toContain("2번 후보");
    expect(text).toContain("요청한 오후 시간대");
    expect(text).toContain("오후 시간대 아님".replace("오후", "오후"));
    expect(text).toContain("후보 모두 선택 참석자 일부의 응답이 아직 확인되지 않았어요");
  });
  it("says there is nothing to compare with a single candidate", () => {
    expect(compareCandidates(views(candidate()), meeting)).toContain("비교할 다른 후보가 없어요");
  });
});

describe("response status", () => {
  it("never treats no-response as decline", () => {
    const text = rsvpStatus({ invited: true, total: 3, responded: 1, pending: ["가", "나"], failed: ["다"], top: { accepted: 1, declined: 0, tentative: 0, noResponse: 2 } });
    expect(text).toContain("3명 중 1명이 응답");
    expect(text).toContain("응답이 없다고 불참으로 보지 않아요");
    expect(text).toContain("요청이 전달되지 않아 확인할 수 없어요");
  });
  it("distinguishes not sent and not applicable", () => {
    expect(rsvpStatus({ invited: false, total: 2, responded: 0, pending: [], failed: [] })).toContain("아직 참석 가능 여부 요청을 보내지 않았어요");
    expect(rsvpStatus(undefined)).toContain("확인하는 단계가 아니에요");
  });
  it("builds a view from round rows", () => {
    const view = viewOfRow({ candidate: candidate(), accepted: 1, declined: 0, tentative: 0, noResponse: 1, people: { accepted: ["지연"], declined: [], tentative: [], noResponse: ["태오"] } }, ["민수", "서연"]);
    expect(view.optional).toMatchObject({ possible: 1, waiting: 1 });
  });
});

describe("buildReply", () => {
  const base = { interpretation: { assistantMessage: "AI가 쓴 문장" }, current: meeting, next: meeting, changedFields: [] as string[], hasProposalOrChoice: false, context: { views: [] as CandidateView[], text: "" } };
  it("refuses to confirm or cancel by chat and changes nothing", () => {
    const confirm = buildReply({ ...base, intent: "confirm_meeting", interpretation: { assistantMessage: "회의를 확정했어요!" } });
    expect(confirm.answerOnly).toBe(true);
    expect(confirm.message).toContain("직접 승인");
    expect(confirm.message).not.toContain("확정했어요");
    expect(buildReply({ ...base, intent: "cancel_meeting" }).message).toContain("아무것도 취소하지 않았어요");
  });
  it("answers help and out-of-scope without touching the meeting", () => {
    expect(buildReply({ ...base, intent: "help" }).answerOnly).toBe(true);
    expect(buildReply({ ...base, intent: "out_of_scope" }).message).toContain("회의 일정 조율");
  });
  it("uses the standard sentence when nothing was understood, and keeps AI text for proposals", () => {
    expect(buildReply({ ...base, intent: "unknown" }).message).toBe(NOT_UNDERSTOOD_TEXT);
    expect(buildReply({ ...base, intent: "update_meeting", hasProposalOrChoice: true }).message).toBe("AI가 쓴 문장");
  });
  it("reports the change first when a message both changes and asks", () => {
    const reply = buildReply({ ...base, intent: "explain_recommendation", next: { ...meeting, preferredTime: "morning" }, changedFields: ["preferredTime"], context: { views: views(candidate()), text: "왜?" } });
    expect(reply.answerOnly).toBe(false);
    expect(reply.message.startsWith("선호 시간을 오전으로 변경했어요.")).toBe(true);
  });
});
