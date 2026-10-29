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

export type AttendanceEvidence = "calendar_free" | "calendar_conflict" | "direct_available" | "direct_unavailable" | "tentative" | "no_response" | "calendar_unavailable";

export type VerifyResult = { status: "ok" | "conflict" | "stale"; checkedAt: string; message: string; candidate?: Candidate };

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
  evidence?: Array<{ attendee: string; evidence: AttendanceEvidence }>;
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
  revisions?: MeetingRevision[];
  notifications?: ChangeNotification[];
  createdAt: string;
};

export type MeetingRevision = { version: number; changedFields: Array<keyof MeetingDraft>; before: Partial<MeetingDraft>; after: Partial<MeetingDraft>; changedAt: string };
export type ChangeNotification = { attendee: string; status: "recorded" | "failed" | "skipped"; reason?: string; version: number; at: string };

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
  title?: string;
  team?: string;
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
  summary: string;
  availableCount: number;
  totalCount: number;
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
  confirmed?: { start: string; end: string };
};

export type NextAction =
  | { type: "ask"; field: string }
  | { type: "resolve_person"; options: Array<{ id: string; label: string }> }
  | { type: "resolve_ambiguity"; ambiguity: { field: string; type: string; rawText: string; options: Array<{ id: string; label: string; patch: Partial<MeetingDraft> }> } }
  | { type: "confirm_proposal"; field: string }
  | { type: "show_review" };

// 서버가 해석 → 검증 → 병합한 결과. nextAction은 서버의 대화 플래너가 정해요.
export type ChatResult = {
  intent: string;
  assistantMessage: string;
  meeting: MeetingDraft;
  changedFields: string[];
  proposedFields: Partial<MeetingDraft>;
  ambiguities: Array<{ field: string; rawText: string; reason: string; options?: Array<{ id: string; label: string }> }>;
  nextAction: NextAction;
  issues: string[];
  complete: boolean;
  model: string;
};
