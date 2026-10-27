import { describe, expect, it } from "vitest";
import { recommendSlots, validateMeeting } from "./recommendation.ts";
import type { MeetingDraft } from "./types.ts";

const completeMeeting: MeetingDraft = {
  title: "제품 리뷰",
  purpose: "진행 상황과 다음 계획 리뷰",
  durationMinutes: 30,
  attendees: ["김민지", "박준호", "김민지"],
  requiredAttendees: ["김민지"],
  dateStart: "2026-10-28",
  dateEnd: "2026-10-28",
  preferredTime: "morning",
};

describe("validateMeeting", () => {
  it("reports every required field that is missing", () => {
    expect(validateMeeting({})).toEqual(["회의 제목", "회의 목적", "소요 시간", "참석자", "일정 확정 조건", "선호 시간대", "날짜 범위"]);
  });

  it("rejects an inverted date range", () => {
    expect(validateMeeting({ ...completeMeeting, dateStart: "2026-10-30", dateEnd: "2026-10-28" })).toContain("날짜 범위");
  });
});

describe("recommendSlots", () => {
  it("returns at most three deterministically sorted candidates", () => {
    const first = recommendSlots(completeMeeting);
    const second = recommendSlots(completeMeeting);
    expect(first.map(({ checkedAt: _checkedAt, ...candidate }) => candidate)).toEqual(second.map(({ checkedAt: _checkedAt, ...candidate }) => candidate));
    expect(first).toHaveLength(3);
    expect(first[0].score).toBeGreaterThanOrEqual(first[1].score);
    expect(first[0].total).toBe(2);
  });

  it("sorts a confirmable candidate before unavailable slots", () => {
    const candidates = recommendSlots(
      { ...completeMeeting, attendees: ["주최자"], requiredAttendees: ["주최자"] },
      [{
        id: "host",
        name: "주최자",
        email: "host@nodi.demo",
        timezone: "Asia/Seoul",
        calendarStatus: "connected",
        blocks: [{ start: "2026-10-28T09:00:00+09:00", end: "2026-10-28T17:30:00+09:00", title: "기존 일정" }],
      }],
    );
    expect(candidates[0].requiredAvailable).toBe(true);
    expect(candidates.slice(1).every((candidate) => !candidate.requiredAvailable)).toBe(true);
  });

  it("does not assume an unknown required attendee is available", () => {
    const candidates = recommendSlots({
      ...completeMeeting,
      attendees: ["김민지", "외부 참석자"],
      requiredAttendees: ["외부 참석자"],
    });
    expect(candidates.every((candidate) => !candidate.requiredAvailable)).toBe(true);
    expect(candidates[0].unknown).toContain("외부 참석자");
  });

  it("accepts a Korean given name alias for demo people", () => {
    const candidates = recommendSlots({ ...completeMeeting, attendees: ["민지"], requiredAttendees: ["민지"] });
    expect(candidates[0].unknown).toEqual([]);
  });

  it("skips weekends and returns no slots", () => {
    const candidates = recommendSlots({ ...completeMeeting, dateStart: "2026-10-31", dateEnd: "2026-11-01" });
    expect(candidates).toEqual([]);
  });

  it("uses manual responses without treating no response as available", () => {
    const candidates = recommendSlots(completeMeeting, [], [
      { attendee: "김민지", status: "available", start: "2026-10-28T09:00:00+09:00", end: "2026-10-28T12:00:00+09:00" },
      { attendee: "박준호", status: "no_response" },
    ]);
    expect(candidates[0].available).toBe(1);
    expect(candidates[0].noResponse).toEqual(["박준호"]);
    expect(candidates[0].unknown).toEqual(["박준호"]);
    expect(candidates[0].manualAvailableCount).toBe(1);
    expect(candidates[0].acceptedCount).toBe(0);
    expect(candidates[0].calendarFreeCount).toBe(0);
  });

  it("merges a manual response with connected calendar free/busy", () => {
    const candidates = recommendSlots(completeMeeting, undefined, [
      { attendee: "김민지", status: "available", start: "2026-10-28T09:00:00+09:00", end: "2026-10-28T12:00:00+09:00" },
      { attendee: "박준호", status: "no_response" },
    ]);
    expect(candidates[0].manualAvailableCount).toBe(1);
    expect(candidates[0].calendarFreeCount).toBe(1);
    expect(candidates[0].unknownCount).toBe(0);
  });

  it("changes the recommendation basis when the meeting version changes", () => {
    const first = recommendSlots({ ...completeMeeting, version: 2 });
    const next = recommendSlots({ ...completeMeeting, version: 3 });
    expect(first[0].basedOnMeetingVersion).toBe(2);
    expect(next[0].basedOnMeetingVersion).toBe(3);
    expect(next[0].basisKey).not.toBe(first[0].basisKey);
  });
});
