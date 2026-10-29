import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DemoCalendarProvider } from "./demo-provider.ts";
import { notifyChange, OutboxMailer } from "./mailer.ts";
import { FileMeetingStore } from "./store.ts";
import { recommendSlots } from "./recommendation.ts";

const meeting = { title: "킥오프", purpose: "공유", durationMinutes: 30, attendees: ["김민지", "홍길동"], requiredAttendees: ["김민지"], preferredTime: "any" as const, dateStart: "2026-11-03", dateEnd: "2026-11-04", version: 1 };

describe("change history and notifications", () => {
  it("records a revision and never calls an unreachable person notified", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "nodi-change-"));
    const provider = new DemoCalendarProvider(new FileMeetingStore(path.join(dir, "events.json")));
    const candidate = recommendSlots({ ...meeting, attendees: ["김민지"] })[0];
    const created = await provider.createRoundEvent(meeting, candidate, [], "req-1");
    const updated = await provider.updateEvent(created.id, { ...meeting, title: "킥오프 v2" });
    expect(updated.revisions?.at(-1)).toMatchObject({ changedFields: ["title"], before: { title: "킥오프" }, after: { title: "킥오프 v2" } });
    const unchanged = await provider.updateEvent(created.id, updated.meeting);
    expect(unchanged.revisions).toHaveLength(1); // 바뀐 게 없으면 이력을 만들지 않아요

    const results = await notifyChange(new OutboxMailer(path.join(dir, "outbox.json")), updated);
    expect(results.find((r) => r.attendee === "김민지")?.status).toBe("recorded");
    expect(results.find((r) => r.attendee === "홍길동")).toMatchObject({ status: "failed" }); // 주소를 모르면 실패로 표시
    const saved = await provider.recordNotifications(created.id, results);
    expect(saved.notifications).toHaveLength(2);
  });
});
