import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DemoCalendarProvider } from "./demo-provider.ts";
import { recommendSlots } from "./recommendation.ts";
import { FileMeetingStore } from "./store.ts";
import type { AvailabilityResponse, MeetingDraft } from "./types.ts";

const meeting: MeetingDraft = {
  title: "킥오프",
  purpose: "일정과 담당 업무 결정",
  durationMinutes: 30,
  attendees: ["김민지"],
  requiredAttendees: ["김민지"],
  preferredTime: "morning",
  dateStart: "2026-10-28",
  dateEnd: "2026-10-28",
  timezone: "Asia/Seoul",
};

const availability: AvailabilityResponse[] = [{
  attendee: "김민지",
  status: "available",
  start: "2026-10-28T09:00:00+09:00",
  end: "2026-10-28T12:00:00+09:00",
}];

describe("DemoCalendarProvider", () => {
  it("reuses the saved event for the same confirmation request", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nodi-provider-"));
    const provider = new DemoCalendarProvider(new FileMeetingStore(path.join(directory, "meetings.json")));
    const candidate = recommendSlots(meeting, undefined, availability)[0];
    const first = await provider.createEvent(meeting, candidate, availability, "request-1");
    const second = await provider.createEvent(meeting, candidate, availability, "request-1");
    expect(second.id).toBe(first.id);
    expect(await provider.listEvents()).toHaveLength(1);
  });

  it("blocks confirmation when the latest required response is unavailable", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nodi-provider-"));
    const provider = new DemoCalendarProvider(new FileMeetingStore(path.join(directory, "meetings.json")));
    const candidate = recommendSlots(meeting, undefined, availability)[0];
    await expect(provider.createEvent(meeting, candidate, [{ attendee: "김민지", status: "unavailable" }], "request-2"))
      .rejects.toThrow("일정이 변경");
  });
});
