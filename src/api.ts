async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "요청을 처리하지 못했습니다.");
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
  chat: (body: object) =>
    request<{ assistantMessage: string; meeting: import("./types").MeetingDraft; complete: boolean; model: string }>(
      "/api/chat",
      { method: "POST", body: JSON.stringify(body) },
    ),
  recommendations: (meeting: import("./types").MeetingDraft) =>
    request<{ candidates: import("./types").Candidate[] }>("/api/recommendations", {
      method: "POST",
      body: JSON.stringify({ meeting }),
    }),
  createEvent: (meeting: import("./types").MeetingDraft, candidate: import("./types").Candidate) =>
    request<{ event: import("./types").MeetingEvent; invitationSent: boolean }>("/api/events", {
      method: "POST",
      body: JSON.stringify({ meeting, candidate }),
    }),
  updateEvent: (id: string, meeting: import("./types").MeetingDraft) =>
    request<{ event: import("./types").MeetingEvent }>(`/api/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ meeting }),
    }),
  cancelEvent: (id: string) => request<{ cancelled: boolean }>(`/api/events/${id}`, { method: "DELETE" }),
};
