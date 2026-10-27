import { describe, expect, it } from "vitest";
import { recommendSlots, validateMeeting } from "./recommendation.ts";
import type { MeetingDraft } from "./types.ts";

const completeMeeting: MeetingDraft = {
  title: "제품 리뷰",
  durationMinutes: 30,
  attendees: ["김민지", "박준호", "김민지"],
  requiredAttendees: ["김민지"],
  dateStart: "2026-10-28",
  dateEnd: "2026-10-28",
  preferredTime: "morning",
};

describe("validateMeeting", () => {
  it("reports every required field that is missing", () => {
    expect(validateMeeting({})).toEqual(["회의 제목", "소요 시간", "참석자", "날짜 범위"]);
  });
});

describe("recommendSlots", () => {
  it("returns at most three deterministically sorted candidates", () => {
    const first = recommendSlots(completeMeeting);
    const second = recommendSlots(completeMeeting);
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(first[0].score).toBeGreaterThanOrEqual(first[1].score);
    expect(first[0].total).toBe(2);
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
});
