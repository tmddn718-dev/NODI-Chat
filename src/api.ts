export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
    throw new ApiError(body?.error ?? "요청을 처리하지 못했습니다.", response.status, body?.code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  session: () => request<{ connected: boolean; models: string[] }>("/api/session"),
  connect: (apiKey: string) =>
    request<{ connected: boolean; models: string[] }>("/api/session/connect", {
      method: "POST",
      body: JSON.stringify({ apiKey }),
    }),
  disconnect: () => request<void>("/api/session", { method: "DELETE" }),
  draft: () => request<{ draft: import("./types").DraftRecord | null }>("/api/draft"),
  saveDraft: (expectedVersion: number, payload: import("./types").DraftPayload) =>
    request<{ draft: import("./types").DraftRecord }>("/api/draft", {
      method: "PUT",
      body: JSON.stringify({ expectedVersion, payload }),
    }),
  deleteDraft: () => request<void>("/api/draft", { method: "DELETE" }),
  people: (query = "") => request<{ people: import("./types").PersonSummary[]; mode: "demo" }>(`/api/people?query=${encodeURIComponent(query)}`),
  chat: (body: object) =>
    request<{ assistantMessage: string; meeting: import("./types").MeetingDraft; complete: boolean; model: string }>(
      "/api/chat",
      { method: "POST", body: JSON.stringify(body) },
    ),
  recommendations: (meeting: import("./types").MeetingDraft, availability: import("./types").AvailabilityResponse[], invitationToken?: string) =>
    request<{ candidates: import("./types").Candidate[]; availability: import("./types").AvailabilityResponse[] }>("/api/recommendations", {
      method: "POST",
      body: JSON.stringify({ meeting, availability, invitationToken }),
    }),
  createInvitation: (meeting: import("./types").MeetingDraft, requestId: string) =>
    request<{ token: string; links: import("./types").InvitationLink[]; expiresAt: string; updatedAt: string }>("/api/invitations", {
      method: "POST",
      body: JSON.stringify({ meeting, requestId }),
    }),
  invitation: (token: string) =>
    request<{ invitation: import("./types").InvitationSummary }>(`/api/invitations/${token}`),
  invitationAvailability: (token: string) =>
    request<{ availability: import("./types").AvailabilityResponse[]; updatedAt: string }>(`/api/invitations/${token}/availability`),
  respondToInvitation: (token: string, response: import("./types").AvailabilityResponse) =>
    request<{ saved: boolean; status: string; updatedAt: string }>(`/api/invitations/${token}/responses`, {
      method: "POST",
      body: JSON.stringify({ status: response.status, start: response.start, end: response.end }),
    }),
  events: () => request<{ events: import("./types").MeetingEvent[] }>("/api/events"),
  createEvent: (
    meeting: import("./types").MeetingDraft,
    candidate: import("./types").Candidate,
    availability: import("./types").AvailabilityResponse[],
    requestId: string,
    invitationToken?: string,
  ) =>
    request<{ event: import("./types").MeetingEvent; invitationSent: boolean }>("/api/events", {
      method: "POST",
      body: JSON.stringify({ meeting, candidate, availability, requestId, invitationToken }),
    }),
  updateEvent: (id: string, meeting: import("./types").MeetingDraft) =>
    request<{ event: import("./types").MeetingEvent }>(`/api/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ meeting }),
    }),
  cancelEvent: (id: string) => request<{ cancelled: boolean }>(`/api/events/${id}`, { method: "DELETE" }),
};
