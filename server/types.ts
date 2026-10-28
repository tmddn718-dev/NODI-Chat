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
  recentMeetingAt?: string;
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

export type InvitationRecord = {
  id: string;
  token: string;
  requestId: string;
  meeting: MeetingDraft;
  availability: AvailabilityResponse[];
  participantAccess: Array<{ attendee: string; token: string }>;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CandidateResponseStatus = "accepted" | "declined" | "tentative";

export type RoundParticipant = {
  attendee: string;
  token: string;
  responses: Record<string, CandidateResponseStatus>;
  respondedAt?: string;
  delivery?: "not_sent" | "sent" | "failed";
  deliveryError?: string;
  sentAt?: string;
};

export type RoundRecord = {
  id: string;
  token: string;
  requestId: string;
  meeting: MeetingDraft;
  candidates: Candidate[];
  version: number;
  deadlineAt: string;
  reminderCount: number;
  invitedAt?: string;
  baseUrl?: string;
  participants: RoundParticipant[];
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type DraftPayload = {
  meeting: MeetingDraft;
  availability: AvailabilityResponse[];
  messages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  invitationToken?: string;
  invitationLinks?: Array<{ attendee: string; urlToken: string }>;
  invitationRequestId?: string;
  roundToken?: string;
  input?: string;
  language?: "ko" | "en";
  model?: string;
};

export type DraftRecord = {
  workspaceId: string;
  version: number;
  payload: DraftPayload;
  createdAt: string;
  updatedAt: string;
};
