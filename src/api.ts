export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

const hasKorean = (value: string) => /[가-힣]/.test(value);

// 서버·모델 제공자의 영어/JSON 오류 문구는 화면에 그대로 보여주지 않는다.
function friendlyMessage(message: string | undefined, status: number) {
  if (message && hasKorean(message)) return message;
  if (status === 429) return "요청이 몰리고 있어요. 잠시 뒤에 다시 해 주세요.";
  if (status >= 500) return "일시적인 문제가 생겼어요. 잠시 뒤에 다시 해 주세요.";
  return "요청을 정확히 처리하지 못했어요. 다시 해 주세요.";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  }).catch(() => {
    throw new ApiError("인터넷 연결을 확인하고 다시 해 주세요.", 0);
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null;
    // 서버가 다시 켜졌거나 세션이 만료되면 화면 어디서든 "연결이 끊겼어요" 안내로 이어지게 알려요.
    if (response.status === 401 && body?.code === "session_required" && path !== "/api/session") window.dispatchEvent(new Event("nodi:session-expired"));
    throw new ApiError(friendlyMessage(body?.error, response.status), response.status, body?.code);
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
  createRound: (meeting: import("./types").MeetingDraft, requestId: string, deadlineAt: string) =>
    request<{ round: import("./types").RoundSummary }>("/api/rounds", { method: "POST", body: JSON.stringify({ meeting, requestId, deadlineAt }) }),
  round: (token: string) => request<{ round: import("./types").RoundSummary }>(`/api/rounds/${token}`),
  sendRound: (token: string) => request<{ round: import("./types").RoundSummary }>(`/api/rounds/${token}/send`, { method: "POST" }),
  refreshRound: (token: string) => request<{ round: import("./types").RoundSummary }>(`/api/rounds/${token}/refresh`, { method: "POST" }),
  remindRound: (token: string) => request<{ round: import("./types").RoundSummary }>(`/api/rounds/${token}/remind`, { method: "POST" }),
  extendRound: (token: string, deadlineAt: string) =>
    request<{ round: import("./types").RoundSummary }>(`/api/rounds/${token}/deadline`, { method: "POST", body: JSON.stringify({ deadlineAt }) }),
  confirmRound: (token: string, candidateId: string, requestId: string) =>
    request<{ event: import("./types").MeetingEvent }>(`/api/rounds/${token}/confirm`, { method: "POST", body: JSON.stringify({ candidateId, requestId }) }),
  roundInvitation: (token: string) => request<{ invitation: import("./types").RoundInvitation }>(`/api/rounds/respond/${token}`),
  respondToRound: (token: string, version: number, responses: Record<string, import("./types").CandidateResponseStatus>) =>
    request<{ saved: boolean }>(`/api/rounds/respond/${token}`, { method: "POST", body: JSON.stringify({ version, responses }) }),
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
