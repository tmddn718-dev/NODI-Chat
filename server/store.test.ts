import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FileMeetingStore } from "./store.ts";
import type { MeetingEvent } from "./types.ts";

const event: MeetingEvent = {
  id: "meeting-1",
  status: "confirmed",
  meeting: { title: "테스트 회의" },
  candidate: {
    id: "slot-1", start: "2026-10-28T00:00:00.000Z", end: "2026-10-28T00:30:00.000Z",
    available: 1, total: 1, requiredAvailable: true, score: 100, reason: "조건 충족",
    unavailable: [], unknown: [], tentative: [], noResponse: [],
    calendarFreeCount: 0, manualAvailableCount: 1, conflictCount: 0, unknownCount: 0, acceptedCount: 0,
    checkedAt: "2026-10-27T00:00:00.000Z",
    basedOnMeetingVersion: 1, basisKey: "basis-1",
  },
  availability: [{ attendee: "김민지", status: "available" }],
  version: 1,
  calendarSyncStatus: "not_connected",
  preparationStatus: "not_required",
  invitationSent: false,
  createdAt: "2026-10-27T00:00:00.000Z",
  updatedAt: "2026-10-27T00:00:00.000Z",
};

describe("FileMeetingStore", () => {
  it("persists an event and recovers it with its request id", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nodi-store-"));
    const file = path.join(directory, "meetings.json");
    const store = new FileMeetingStore(file);
    await store.save(event, "request-1");
    expect(await store.findByRequestId("request-1")).toMatchObject({ id: "meeting-1" });
    expect(await store.list()).toEqual([event]);
    expect(JSON.parse(await readFile(file, "utf8"))).toHaveLength(1);
  });

  it("returns the first event for concurrent duplicate confirmation requests", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nodi-store-"));
    const store = new FileMeetingStore(path.join(directory, "meetings.json"));
    const duplicate = { ...event, id: "meeting-2" };
    const [first, second] = await Promise.all([
      store.create(event, "same-request"),
      store.create(duplicate, "same-request"),
    ]);
    expect(first.id).toBe("meeting-1");
    expect(second.id).toBe("meeting-1");
    expect(await store.list()).toHaveLength(1);
  });
});
