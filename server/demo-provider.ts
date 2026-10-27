import { randomUUID } from "node:crypto";
import type { CalendarProvider } from "./calendar.ts";
import { recommendSlots } from "./recommendation.ts";
import type { Candidate, MeetingDraft, MeetingEvent } from "./types.ts";

export class DemoCalendarProvider implements CalendarProvider {
  readonly id = "demo" as const;
  readonly writable = true;
  private events = new Map<string, MeetingEvent>();

  async getFreeBusy(meeting: MeetingDraft) {
    return recommendSlots(meeting);
  }

  async createEvent(meeting: MeetingDraft, candidate: Candidate) {
    const latest = recommendSlots(meeting).find((item) => item.id === candidate.id);
    if (!latest || latest.score !== candidate.score || !latest.requiredAvailable) {
      throw new Error("확정 직전 일정이 변경되었습니다. 후보 시간을 다시 확인해 주세요.");
    }
    const event: MeetingEvent = {
      id: randomUUID(),
      status: "confirmed",
      meeting,
      candidate: latest,
      createdAt: new Date().toISOString(),
    };
    this.events.set(event.id, event);
    return event;
  }

  async updateEvent(id: string, meeting: MeetingDraft) {
    const existing = this.events.get(id);
    if (!existing || existing.status === "cancelled") throw new Error("수정할 회의를 찾을 수 없습니다.");
    const updated = { ...existing, meeting };
    this.events.set(id, updated);
    return updated;
  }

  async deleteEvent(id: string) {
    const existing = this.events.get(id);
    if (!existing || existing.status === "cancelled") throw new Error("취소할 회의를 찾을 수 없습니다.");
    this.events.set(id, { ...existing, status: "cancelled" });
  }
}
