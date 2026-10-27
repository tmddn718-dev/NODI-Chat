import { describe, expect, it } from "vitest";
import { getGuidedStep } from "./guided";
import type { MeetingDraft } from "./types";

describe("getGuidedStep", () => {
  it("moves through the required meeting fields in order", () => {
    const now = new Date("2026-10-27T03:00:00Z");
    const meeting: MeetingDraft = {};
    expect(getGuidedStep(meeting, "ko", now)?.key).toBe("title");
    meeting.title = "프로젝트 킥오프";
    expect(getGuidedStep(meeting, "ko", now)?.key).toBe("purpose");
    meeting.purpose = "일정 결정";
    meeting.durationMinutes = 30;
    meeting.attendees = ["김민지"];
    expect(getGuidedStep(meeting, "ko", now)?.key).toBe("availabilityRule");
    meeting.requiredAttendees = ["김민지"];
    expect(getGuidedStep(meeting, "ko", now)?.key).toBe("preferredTime");
    meeting.preferredTime = "morning";
    meeting.dateStart = "2026-10-28";
    expect(getGuidedStep(meeting, "ko", now)?.key).toBe("dateEnd");
    meeting.dateEnd = "2026-10-30";
    expect(getGuidedStep(meeting, "ko", now)).toBeNull();
  });

  it("creates date choices with exact ISO dates", () => {
    const step = getGuidedStep(
      { title: "리뷰", purpose: "공유", durationMinutes: 30, attendees: ["민지"], requiredAttendees: [], preferredTime: "any" },
      "ko",
      new Date("2026-10-27T03:00:00Z"),
    );
    expect(step?.choices[0].message).toContain("2026-10-28");
    expect(step?.choices[0].patch).toEqual({ dateStart: "2026-10-28" });
  });
});
