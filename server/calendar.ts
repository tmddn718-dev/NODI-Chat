import type { AvailabilityResponse, Candidate, MeetingDraft, MeetingEvent } from "./types.ts";

export interface CalendarProvider {
  readonly id: "demo" | "google" | "microsoft" | "ical" | "caldav";
  readonly writable: boolean;
  getFreeBusy(meeting: MeetingDraft, responses?: AvailabilityResponse[]): Promise<Candidate[]>;
  createEvent(meeting: MeetingDraft, candidate: Candidate, responses: AvailabilityResponse[], requestId: string): Promise<MeetingEvent>;
  updateEvent(id: string, meeting: MeetingDraft): Promise<MeetingEvent>;
  deleteEvent(id: string): Promise<void>;
}

export class CalendarIntegrationRequiredError extends Error {
  constructor(provider: string) {
    super(`${provider} 캘린더는 아직 연결되지 않았습니다.`);
  }
}

export class FutureCalendarProvider implements CalendarProvider {
  readonly writable: boolean;

  constructor(
    readonly id: "google" | "microsoft" | "ical" | "caldav",
    writable = id !== "ical",
  ) {
    this.writable = writable;
  }

  async getFreeBusy(): Promise<Candidate[]> {
    throw new CalendarIntegrationRequiredError(this.id);
  }

  async createEvent(): Promise<MeetingEvent> {
    throw new CalendarIntegrationRequiredError(this.id);
  }

  async updateEvent(): Promise<MeetingEvent> {
    throw new CalendarIntegrationRequiredError(this.id);
  }

  async deleteEvent(): Promise<void> {
    throw new CalendarIntegrationRequiredError(this.id);
  }
}
