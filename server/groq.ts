import type { MeetingDraft } from "./types.ts";

const GROQ_BASE = "https://api.groq.com/openai/v1";

export class UpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

async function groqFetch(apiKey: string, path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${GROQ_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new UpstreamError("Groq API에 연결할 수 없습니다. 네트워크 상태를 확인해 주세요.", 502, "network_error");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    const message =
      response.status === 401
        ? "API Key가 올바르지 않습니다."
        : response.status === 429
          ? "Groq 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
          : body?.error?.message ?? "Groq 요청에 실패했습니다.";
    throw new UpstreamError(message, response.status === 401 ? 401 : 502, response.status === 429 ? "rate_limited" : "groq_error");
  }
  return response.json();
}

export async function listModels(apiKey: string) {
  const result = (await groqFetch(apiKey, "/models")) as { data?: Array<{ id: string; active?: boolean }> };
  return (result.data ?? []).filter((model) => model.active !== false).map((model) => model.id).sort();
}

type ChatMessage = { role: "user" | "assistant"; content: string };

function normalizeMeeting(value: unknown, fallback: MeetingDraft): MeetingDraft {
  if (!value || typeof value !== "object") return fallback;
  const input = value as Record<string, unknown>;
  const text = (key: string) => typeof input[key] === "string" ? input[key].trim().slice(0, 300) || undefined : undefined;
  const list = (key: string) => Array.isArray(input[key])
    ? [...new Set(input[key].filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 50)
    : undefined;
  const duration = typeof input.durationMinutes === "number" && input.durationMinutes >= 15 && input.durationMinutes <= 480
    ? Math.round(input.durationMinutes)
    : undefined;
  const date = (key: string) => {
    const value = text(key);
    return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  };
  return {
    ...fallback,
    title: text("title") ?? fallback.title,
    purpose: text("purpose") ?? fallback.purpose,
    durationMinutes: duration ?? fallback.durationMinutes,
    attendees: list("attendees") ?? fallback.attendees,
    requiredAttendees: list("requiredAttendees") ?? fallback.requiredAttendees,
    dateStart: date("dateStart") ?? fallback.dateStart,
    dateEnd: date("dateEnd") ?? fallback.dateEnd,
    preferredTime: ["morning", "afternoon", "any"].includes(String(input.preferredTime))
      ? input.preferredTime as MeetingDraft["preferredTime"]
      : fallback.preferredTime,
    meetingType: ["online", "in-person"].includes(String(input.meetingType))
      ? input.meetingType as MeetingDraft["meetingType"]
      : fallback.meetingType,
    location: text("location") ?? fallback.location,
    priority: text("priority") ?? fallback.priority,
  };
}

export async function chatWithGroq(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  meeting: MeetingDraft,
  language: "ko" | "en",
) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const system = `You are NODI, a concise meeting scheduling assistant. Today in Asia/Seoul is ${today}.
Return only a valid JSON object with keys "assistantMessage" and "meeting". Never use markdown.
The meeting object must preserve known values and may contain: title, purpose, durationMinutes, attendees, requiredAttendees, dateStart, dateEnd, preferredTime (morning|afternoon|any), meetingType (online|in-person), location, priority.
Extract new facts from the latest user message. Resolve relative dates into YYYY-MM-DD in Asia/Seoul. Remove duplicate attendees case-insensitively.
Required fields are title, durationMinutes, attendees, dateStart, dateEnd. Ask for only the most useful missing information, ideally grouping two closely related items. Never ask again for a known field.
When all required fields exist, say that you found enough information and will calculate candidates. Do not invent availability, conflicts, scores, or calendar connection status.
Reply in ${language === "ko" ? "natural Korean" : "English"}. Current draft: ${JSON.stringify(meeting)}`;
  const payload = await groqFetch(apiKey, "/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, ...messages.slice(-12)],
    }),
  }) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new UpstreamError("Groq 응답이 비어 있습니다.", 502, "empty_response");
  try {
    const parsed = JSON.parse(content) as { assistantMessage?: unknown; meeting?: unknown };
    if (typeof parsed.assistantMessage !== "string" || !parsed.assistantMessage.trim()) throw new Error("missing message");
    return {
      assistantMessage: parsed.assistantMessage.trim().slice(0, 4000),
      meeting: normalizeMeeting(parsed.meeting, meeting),
    };
  } catch {
    throw new UpstreamError("Groq 응답을 처리하지 못했습니다. 다시 시도해 주세요.", 502, "invalid_response");
  }
}
