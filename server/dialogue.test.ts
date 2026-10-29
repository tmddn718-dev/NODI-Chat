import { describe, expect, it } from "vitest";
import { demoPeople } from "./demo-data.ts";
import { applyInterpretation, type Interpretation } from "./dialogue.ts";

const interp = (over: Partial<Interpretation>): Interpretation => ({ intent: "update_condition", assistantMessage: "ok", meetingPatch: {}, removeFields: [], proposedFields: {}, ambiguities: [], ...over });
const base = { version: 1, timezone: "Asia/Seoul" };

describe("applyInterpretation", () => {
  it("extracts several conditions at once and asks only for what is missing", () => {
    const r = applyInterpretation(base, interp({ meetingPatch: { title: "업무 리뷰", durationMinutes: 30, attendees: ["민지"], dateStart: "2026-11-06", dateEnd: "2026-11-06", preferredTime: "afternoon" } }), demoPeople);
    expect(r.meeting.attendees).toEqual(["김민지"]);
    expect(r.nextAction).toEqual({ type: "ask", field: "purpose" });
  });
  it("keeps untouched fields when only some change and prunes required attendees", () => {
    const cur = { ...base, title: "리뷰", purpose: "공유", durationMinutes: 30, attendees: ["김민지", "박준호"], requiredAttendees: ["박준호"] };
    const r = applyInterpretation(cur, interp({ meetingPatch: { attendees: ["김민지", "이소라"] } }), demoPeople);
    expect(r.meeting.title).toBe("리뷰");
    expect(r.meeting.requiredAttendees).toEqual([]);
    expect(r.changedFields).toEqual(["attendees", "requiredAttendees"]);
  });
  it("rejects bad durations and reversed dates", () => {
    const r = applyInterpretation({ ...base, dateStart: "2026-11-10" }, interp({ meetingPatch: { durationMinutes: 2, dateEnd: "2026-11-01" } }), demoPeople);
    expect(r.meeting.durationMinutes).toBeUndefined();
    expect(r.meeting.dateEnd).toBeUndefined();
    expect(r.issues).toHaveLength(1);
  });
  it("keeps vague values as proposals, not facts", () => {
    const r = applyInterpretation(base, interp({ proposedFields: { durationMinutes: 30 } }), demoPeople);
    expect(r.meeting.durationMinutes).toBeUndefined();
    expect(r.proposedFields.durationMinutes).toBe(30);
    expect(r.nextAction).toEqual({ type: "confirm_proposal", field: "durationMinutes" });
  });
  it("asks the user to pick when a name matches several people", () => {
    const two = [...demoPeople, { ...demoPeople[0], id: "m2", name: "이민지", email: "m2@nodi.demo" }];
    const r = applyInterpretation(base, interp({ meetingPatch: { attendees: ["민지"] } }), two);
    expect(r.meeting.attendees).toEqual([]);
    expect(r.nextAction.type).toBe("resolve_person");
  });
  it("removes only clearly removed fields", () => {
    const r = applyInterpretation({ ...base, title: "a", purpose: "b" }, interp({ intent: "remove_condition", removeFields: ["purpose", "timezone"] }), demoPeople);
    expect(r.meeting.purpose).toBeUndefined();
    expect(r.meeting.timezone).toBe("Asia/Seoul");
  });
  it("rejects past dates, lowercases external emails and explains required-attendee cascades", () => {
    const now = new Date("2026-10-29T03:00:00Z");
    const past = applyInterpretation({ ...base, dateStart: "2026-11-02" }, interp({ meetingPatch: { dateStart: "2026-10-01" } }), demoPeople, now);
    expect(past.meeting.dateStart).toBe("2026-11-02");
    expect(past.issues).toHaveLength(1);
    const mail = applyInterpretation(base, interp({ meetingPatch: { attendees: ["Guest@Corp.com", "guest@corp.com"] } }), demoPeople, now);
    expect(mail.meeting.attendees).toEqual(["guest@corp.com"]);
    const cur = { ...base, attendees: ["김민지", "박준호"], requiredAttendees: ["박준호"] };
    expect(applyInterpretation(cur, interp({ meetingPatch: { attendees: ["김민지"] } }), demoPeople, now).issues[0]).toContain("박준호");
  });
  it("turns AI interpretation options into one choice without changing the set title", () => {
    const cur = { ...base, title: "프로젝트 킥오프" };
    const r = applyInterpretation(cur, interp({ ambiguities: [{ field: "purpose", type: "multiple_meanings", rawText: "아이디어 회의", reason: "multiple_meanings", options: [
      { id: "a", label: "아이디어를 다양하게 모으기", patch: { purpose: "다양한 아이디어 도출" } },
      { id: "b", label: "회의 종류를 아이디어 회의로 변경", patch: { title: "아이디어 회의" } },
      { id: "c", label: "빈 선택지", patch: { durationMinutes: 1 } },
    ] }] }), demoPeople);
    expect(r.meeting.title).toBe("프로젝트 킥오프");
    expect(r.meeting.purpose).toBeUndefined();
    expect(r.nextAction.type).toBe("resolve_ambiguity");
    if (r.nextAction.type === "resolve_ambiguity") expect(r.nextAction.ambiguity.options.map((o) => o.id)).toEqual(["a", "b"]);
  });
  it("ignores an ambiguity with fewer than two usable options", () => {
    const r = applyInterpretation(base, interp({ ambiguities: [{ field: "title", type: "multiple_meanings", rawText: "x", reason: "x", options: [{ id: "a", label: "a", patch: { title: "a" } }] }] }), demoPeople);
    expect(r.nextAction).toEqual({ type: "ask", field: "title" });
  });
  it("proposes a whole team for a named team and asks which team for a vague one", () => {
    const named = applyInterpretation(base, interp({ meetingPatch: { attendees: ["디자인팀"] } }), demoPeople);
    expect(named.meeting.attendees).toBeUndefined();
    expect(named.proposedFields.attendees).toEqual(["이소라"]);
    expect(named.nextAction).toEqual({ type: "confirm_proposal", field: "attendees" });
    const vague = applyInterpretation(base, interp({ meetingPatch: { attendees: ["팀원들"] } }), demoPeople);
    expect(vague.nextAction.type).toBe("resolve_ambiguity");
    if (vague.nextAction.type === "resolve_ambiguity") expect(vague.nextAction.ambiguity.options.length).toBeGreaterThanOrEqual(2);
  });
  it("drops required attendees the AI made up when there are no attendees", () => {
    const r = applyInterpretation(base, interp({ meetingPatch: { title: "아이디어 회의", requiredAttendees: ["Seoul Team"] } }), demoPeople);
    expect(r.meeting.requiredAttendees).toBeUndefined();
    expect(r.meeting.title).toBe("아이디어 회의");
  });
});
