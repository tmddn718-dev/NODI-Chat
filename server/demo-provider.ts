import { randomUUID } from "node:crypto";
import type { CalendarProvider } from "./calendar.ts";
import { FileMeetingStore } from "./store.ts";
import { recommendSlots } from "./recommendation.ts";
import type { AvailabilityResponse, Candidate, ChangeNotification, MeetingDraft } from "./types.ts";

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
    return this.persist(meeting, latest, responses, requestId);
  }

  // 후보 라운드는 필수 참석자 기준으로 이미 서버가 재검증한 후보를 받는다.
  async createRoundEvent(meeting: MeetingDraft, candidate: Candidate, responses: AvailabilityResponse[], requestId: string) {
    const existing = await this.store.findByRequestId(requestId);
    if (existing) return existing;
    return this.persist(meeting, candidate, responses, requestId);
  }

  private persist(meeting: MeetingDraft, latest: Candidate, responses: AvailabilityResponse[], requestId: string) {
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
    const keys = [...new Set([...Object.keys(existing.meeting), ...Object.keys(meeting)])].filter((key) => key !== "version") as Array<keyof MeetingDraft>;
    const changedFields = keys.filter((key) => JSON.stringify(existing.meeting[key]) !== JSON.stringify(meeting[key]));
    const now = new Date().toISOString();
    const revision = { version: existing.version + 1, changedFields, before: Object.fromEntries(changedFields.map((key) => [key, existing.meeting[key]])), after: Object.fromEntries(changedFields.map((key) => [key, meeting[key]])), changedAt: now };
    const updated = { ...existing, meeting, version: existing.version + 1, updatedAt: now, revisions: [...(existing.revisions ?? []), ...(changedFields.length ? [revision] : [])] };
    return this.store.save(updated, existing.requestId);
  }

  // 알림 결과를 저장해요. 재시도할 때는 실패한 사람의 결과만 새 결과로 바꿔요.
  async recordNotifications(id: string, results: ChangeNotification[]) {
    const existing = await this.store.get(id);
    if (!existing) throw new Error("회의를 찾을 수 없습니다.");
    const names = new Set(results.map((item) => item.attendee));
    const notifications = [...(existing.notifications ?? []).filter((item) => !names.has(item.attendee)), ...results];
    return this.store.save({ ...existing, notifications }, existing.requestId);
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
