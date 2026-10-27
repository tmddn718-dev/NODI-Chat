import { randomUUID } from "node:crypto";
import type { CalendarProvider } from "./calendar.ts";
import { FileMeetingStore } from "./store.ts";
import { recommendSlots } from "./recommendation.ts";
import type { AvailabilityResponse, Candidate, MeetingDraft } from "./types.ts";

export class DemoCalendarProvider implements CalendarProvider {
  readonly id = "demo" as const;
  readonly writable = true;

  constructor(private readonly store = new FileMeetingStore()) {}

  async getFreeBusy(meeting: MeetingDraft, responses?: AvailabilityResponse[]) {
    return recommendSlots(meeting, undefined, responses);
  }

  async createEvent(meeting: MeetingDraft, candidate: Candidate, responses: AvailabilityResponse[], requestId: string) {
    const existing = await this.store.findByRequestId(requestId);
    if (existing) return existing;
    const latest = recommendSlots(meeting, undefined, responses).find((item) => item.id === candidate.id);
    if (!latest || latest.basisKey !== candidate.basisKey || latest.basedOnMeetingVersion !== candidate.basedOnMeetingVersion || !latest.requiredAvailable) {
      throw new Error("확정 직전 일정이 변경되었습니다. 후보 시간을 다시 확인해 주세요.");
    }
    const now = new Date().toISOString();
    const event = {
      id: randomUUID(),
      status: "confirmed" as const,
      meeting,
      candidate: latest,
      availability: responses,
      version: 1,
      calendarSyncStatus: "not_connected" as const,
      preparationStatus: "not_required" as const,
      invitationSent: false,
      createdAt: now,
      updatedAt: now,
    };
    return this.store.create(event, requestId);
  }

  async updateEvent(id: string, meeting: MeetingDraft) {
    const existing = await this.store.get(id);
    if (!existing || existing.status === "cancelled") throw new Error("수정할 회의를 찾을 수 없습니다.");
    const updated = { ...existing, meeting, version: existing.version + 1, updatedAt: new Date().toISOString() };
    return this.store.save(updated, existing.requestId);
  }

  async deleteEvent(id: string) {
    const existing = await this.store.get(id);
    if (!existing || existing.status === "cancelled") throw new Error("취소할 회의를 찾을 수 없습니다.");
    await this.store.save({ ...existing, status: "cancelled", version: existing.version + 1, updatedAt: new Date().toISOString() }, existing.requestId);
  }

  async listEvents() {
    return (await this.store.list()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
