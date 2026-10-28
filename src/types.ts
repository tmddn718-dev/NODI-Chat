export type MeetingDraft = {
  version?: number;
  title?: string;
  purpose?: string;
  durationMinutes?: number;
  attendees?: string[];
  requiredAttendees?: string[];
  dateStart?: string;
  dateEnd?: string;
  preferredTime?: "morning" | "afternoon" | "any";
  timezone?: string;
  meetingType?: "online" | "in-person";
  location?: string;
  priority?: string;
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
  tentative: string[];
  noResponse: string[];
  calendarFreeCount: number;
  manualAvailableCount: number;
  conflictCount: number;
  unknownCount: number;
  acceptedCount: number;
  checkedAt: string;
  basedOnMeetingVersion: number;
  basisKey: string;
};

export type AvailabilityStatus = "available" | "unavailable" | "tentative" | "no_response";

export type AvailabilityResponse = {
  attendee: string;
  status: AvailabilityStatus;
  start?: string;
  end?: string;
};

export type MeetingEvent = {
  id: string;
  status: "confirmed" | "cancelled";
  meeting: MeetingDraft;
  candidate: Candidate;
  availability: AvailabilityResponse[];
  version: number;
  updatedAt: string;
  calendarSyncStatus: "not_connected" | "synced" | "failed";
  preparationStatus: "not_required" | "in_progress" | "awaiting_input" | "ready" | "attention_required";
  invitationSent: boolean;
  createdAt: string;
};

export type InvitationSummary = {
  meeting: MeetingDraft;
  attendee: string;
  currentStatus: AvailabilityStatus;
  expiresAt: string;
  updatedAt: string;
};

export type InvitationLink = { attendee: string; urlToken: string };

export type PersonSummary = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  calendarStatus: "connected" | "unavailable";
  recent: boolean;
  lastMetAt?: string;
};

export type DraftPayload = {
  meeting: MeetingDraft;
  availability: AvailabilityResponse[];
  messages: Message[];
  invitationToken?: string;
  invitationLinks?: InvitationLink[];
  invitationRequestId?: string;
  roundToken?: string;
  input?: string;
  language?: "ko" | "en";
  model?: string;
};

export type DraftRecord = {
  version: number;
  payload: DraftPayload;
  createdAt: string;
  updatedAt: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type CandidateResponseStatus = "accepted" | "declined" | "tentative";

export type RoundRow = {
  candidate: Candidate;
  rank: number;
  accepted: number;
  declined: number;
  tentative: number;
  noResponse: number;
  reason: string;
};

export type RoundSummary = {
  token: string;
  version: number;
  deadlineAt: string;
  phase: "collecting" | "final";
  responded: number;
  total: number;
  reminderCount: number;
  rows: RoundRow[];
  invitedAt?: string;
  participants: Array<{ attendee: string; urlToken: string; responded: boolean; delivery: "not_sent" | "sent" | "failed"; deliveryError?: string }>;
  updatedAt: string;
};

export type RoundInvitation = {
  meeting: Pick<MeetingDraft, "title" | "purpose" | "durationMinutes">;
  attendee: string;
  candidates: Array<{ id: string; start: string; end: string }>;
  responses: Record<string, CandidateResponseStatus>;
  version: number;
  deadlineAt: string;
  pastDeadline: boolean;
};
