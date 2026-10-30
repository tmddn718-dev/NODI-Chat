import { describe, expect, it } from "vitest";
import { demoPeople } from "./demo-data.ts";
import { interpretScenario, UNSUPPORTED_HELP } from "./scenario.ts";

// 2026-10-30(금) 정오(한국 시간)
const now = new Date("2026-10-30T03:00:00Z");
const run = (text: string, meeting = {}, field?: string) => interpretScenario(text, meeting, demoPeople, now, field);

describe("scenario interpreter", () => {
  it("reads attendees, duration, date and time of day from one sentence", () => {
    const r = run("내일 오후에 김민지, 박준호랑 30분 회의 잡아줘");
    expect(r.meetingPatch).toMatchObject({ attendees: ["김민지", "박준호"], durationMinutes: 30, dateStart: "2026-10-31", dateEnd: "2026-10-31", preferredTime: "afternoon" });
    expect(r.intent).toBe("create_meeting");
  });

  it("marks required and optional attendees from the words that follow each name", () => {
    const r = run("김민지, 박준호는 필수고 이소라는 선택이야");
    expect(r.meetingPatch.attendees).toEqual(["김민지", "박준호", "이소라"]);
    expect(r.meetingPatch.requiredAttendees).toEqual(["김민지", "박준호"]);
  });

  it("resolves next week to Monday–Friday and keeps team names raw for the dialogue step to expand", () => {
    const r = run("다음 주에 개발팀이랑 1시간");
    expect(r.meetingPatch).toMatchObject({ dateStart: "2026-11-02", dateEnd: "2026-11-06", durationMinutes: 60, attendees: ["개발팀"] });
  });

  it("proposes instead of stating a vague duration", () => {
    const r = run("짧게 하고 싶어");
    expect(r.meetingPatch).toEqual({});
    expect(r.proposedFields.durationMinutes).toBe(30);
  });

  it("treats a short answer to the asked field as that field", () => {
    expect(run("디자인 스프린트 계획", {}, "title").meetingPatch.title).toBe("디자인 스프린트 계획");
    expect(run("신규 기능 아이디어 논의로 할게", {}, "purpose").meetingPatch.purpose).toBe("신규 기능 아이디어 논의");
  });

  it("guides on input it cannot read and never invents values", () => {
    const r = run("점심 메뉴 추천해줘", {}, "title");
    expect(r.assistantMessage).toBe(UNSUPPORTED_HELP);
    expect(r.meetingPatch).toEqual({});
    expect(r.proposedFields).toEqual({});
  });

  it("removes a named attendee", () => {
    const r = run("이소라는 빼줘", { attendees: ["김민지", "이소라"], requiredAttendees: ["이소라"] });
    expect(r.meetingPatch.attendees).toEqual(["김민지"]);
    expect(r.meetingPatch.requiredAttendees).toEqual([]);
  });
});
