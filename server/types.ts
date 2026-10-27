export type MeetingDraft = {
  title?: string;
  purpose?: string;
  durationMinutes?: number;
  attendees?: string[];
  requiredAttendees?: string[];
  dateStart?: string;
  dateEnd?: string;
  preferredTime?: "morning" | "afternoon" | "any";
  meetingType?: "online" | "in-person";
  location?: string;
  priority?: string;
};

export type CalendarBlock = {
  start: string;
  end: string;
  title: string;
};

export type DemoPerson = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  calendarStatus: "connected" | "unavailable";
  blocks: CalendarBlock[];
};

export type Candidate = {
  id: string;
  start: string;
  end: string;
  available: number;
  total: number;
  requiredAvailable: boolean;
  score: number;
  reason: string;
  unavailable: string[];
  unknown: string[];
};

export type MeetingEvent = {
  id: string;
  status: "confirmed" | "cancelled";
  meeting: MeetingDraft;
  candidate: Candidate;
  createdAt: string;
};
