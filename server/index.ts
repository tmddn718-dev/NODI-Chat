import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { demoPeople } from "./demo-data.ts";
import { DemoCalendarProvider } from "./demo-provider.ts";
import { DraftConflictError, DraftStore } from "./draft-store.ts";
import { chatWithGroq, listModels, UpstreamError } from "./groq.ts";
import { InvitationStore } from "./invitation-store.ts";
import { searchPeople } from "./people.ts";
import { dispatch, OutboxMailer } from "./mailer.ts";
import { RoundClosedError, RoundStaleError, RoundStore, requiredFirstCandidates, splitAttendees, summarize } from "./round.ts";
import { validateMeeting } from "./recommendation.ts";
import type { AvailabilityResponse, Candidate, DraftPayload, MeetingDraft } from "./types.ts";

const app = express();
const port = Number(process.env.PORT) || 3001;
const sessionCookie = "nodi_session";
const sessionTtl = 4 * 60 * 60 * 1000;
const sessions = new Map<string, { apiKey: string; models: string[]; touchedAt: number; workspaceId: string }>();
const provider = new DemoCalendarProvider();
const invitationStore = new InvitationStore();
const draftStore = new DraftStore();
const roundStore = new RoundStore();
const mailer = new OutboxMailer();
const baseUrlOf = (req: Request) => process.env.NODI_PUBLIC_URL ?? (req.get("origin") ?? `${req.protocol}://${req.get("host")}`);

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

function getSession(req: Request) {
  const id = req.cookies[sessionCookie] as string | undefined;
  const session = id ? sessions.get(id) : undefined;
  if (session) session.touchedAt = Date.now();
  return { id, session };
}

function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!getSession(req).session) {
    res.status(401).json({ error: "Groq 연결이 필요합니다.", code: "session_required" });
    return;
  }
  next();
}

function clearSession(res: Response, id?: string) {
  if (id) sessions.delete(id);
  res.clearCookie(sessionCookie, { httpOnly: true, sameSite: "strict" });
}

function parseAvailability(value: unknown): AvailabilityResponse[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): AvailabilityResponse[] => {
    if (!item || typeof item !== "object") return [];
    const input = item as Record<string, unknown>;
    const attendee = typeof input.attendee === "string" ? input.attendee.trim().slice(0, 200) : "";
    const status = input.status;
    if (!attendee || !["available", "unavailable", "tentative", "no_response"].includes(String(status))) return [];
    const dateTime = (field: "start" | "end") => typeof input[field] === "string" && Number.isFinite(Date.parse(input[field] as string))
      ? input[field] as string
      : undefined;
    return [{ attendee, status: status as AvailabilityResponse["status"], start: dateTime("start"), end: dateTime("end") }];
  });
}

function readInvitationToken(value: unknown) {
  return typeof value === "string" && /^[a-f0-9]{48}$/.test(value) ? value : "";
}

function parseDraftPayload(value: unknown): DraftPayload {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const messages = Array.isArray(input.messages) ? input.messages.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const message = item as Record<string, unknown>;
    if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") return [];
    return [{
      id: typeof message.id === "string" ? message.id.slice(0, 100) : crypto.randomUUID(),
      role: message.role as "user" | "assistant",
      content: message.content.slice(0, 4000),
    }];
  }) : [];
  const links = Array.isArray(input.invitationLinks) ? input.invitationLinks.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const link = item as Record<string, unknown>;
    return typeof link.attendee === "string" && readInvitationToken(link.urlToken)
      ? [{ attendee: link.attendee.slice(0, 200), urlToken: link.urlToken as string }]
      : [];
  }) : undefined;
  return {
    meeting: (input.meeting && typeof input.meeting === "object" ? input.meeting : {}) as MeetingDraft,
    availability: parseAvailability(input.availability),
    messages,
    invitationToken: readInvitationToken(input.invitationToken) || undefined,
    invitationLinks: links,
    roundToken: readInvitationToken(input.roundToken) || undefined,
    invitationRequestId: typeof input.invitationRequestId === "string" ? input.invitationRequestId.slice(0, 100) : undefined,
    input: typeof input.input === "string" ? input.input.slice(0, 4000) : undefined,
    language: input.language === "en" ? "en" : "ko",
    model: typeof input.model === "string" ? input.model.slice(0, 200) : undefined,
  };
}

async function resolveAvailability(body: Record<string, unknown>) {
  const invitationToken = readInvitationToken(body.invitationToken);
  if (!invitationToken) return parseAvailability(body.availability);
  const invitation = await invitationStore.get(invitationToken);
  if (!invitation) throw new Error("초대 응답을 찾을 수 없습니다. 링크를 다시 만들어 주세요.");
  return invitation.availability;
}

app.get("/api/health", (_req, res) => res.json({ ok: true, mode: "demo" }));

app.get("/api/session", (req, res) => {
  const { session } = getSession(req);
  res.json({ connected: Boolean(session), models: session?.models ?? [] });
});

app.post("/api/session/connect", async (req, res, next) => {
  try {
    const apiKey = typeof req.body.apiKey === "string" ? req.body.apiKey.trim() : "";
    if (!apiKey || apiKey.length > 300) {
      res.status(400).json({ error: "API Key를 입력해 주세요.", code: "invalid_input" });
      return;
    }
    const models = await listModels(apiKey);
    if (!models.length) throw new UpstreamError("사용 가능한 Groq 모델이 없습니다.", 502, "no_models");
    const previous = getSession(req).id;
    if (previous) sessions.delete(previous);
    const id = crypto.randomBytes(32).toString("hex");
    const workspaceId = crypto.createHash("sha256").update(apiKey).digest("hex");
    sessions.set(id, { apiKey, models, touchedAt: Date.now(), workspaceId });
    res.cookie(sessionCookie, id, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    });
    res.json({ connected: true, models });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/session", (req, res) => {
  clearSession(res, getSession(req).id);
  res.status(204).end();
});

app.get("/api/draft", requireSession, async (req, res, next) => {
  try {
    const draft = await draftStore.get(getSession(req).session!.workspaceId);
    res.json({ draft: draft ? { version: draft.version, payload: draft.payload, createdAt: draft.createdAt, updatedAt: draft.updatedAt } : null });
  } catch (error) {
    next(error);
  }
});

app.put("/api/draft", requireSession, async (req, res, next) => {
  try {
    const expectedVersion = Number(req.body.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) {
      return res.status(400).json({ error: "초안 버전을 확인해 주세요.", code: "invalid_input" });
    }
    const draft = await draftStore.save(getSession(req).session!.workspaceId, expectedVersion, parseDraftPayload(req.body.payload));
    res.json({ draft: { version: draft.version, payload: draft.payload, createdAt: draft.createdAt, updatedAt: draft.updatedAt } });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/draft", requireSession, async (req, res, next) => {
  try {
    await draftStore.delete(getSession(req).session!.workspaceId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.get("/api/models", requireSession, async (req, res, next) => {
  try {
    const { session } = getSession(req);
    const models = await listModels(session!.apiKey);
    session!.models = models;
    res.json({ models });
  } catch (error) {
    next(error);
  }
});

app.post("/api/chat", requireSession, async (req, res, next) => {
  try {
    const { session } = getSession(req);
    const messages = Array.isArray(req.body.messages)
      ? req.body.messages
          .filter((item: unknown) => {
            if (!item || typeof item !== "object") return false;
            const value = item as { role?: unknown; content?: unknown };
            return (value.role === "user" || value.role === "assistant") && typeof value.content === "string";
          })
          .map((item: { role: "user" | "assistant"; content: string }) => ({ ...item, content: item.content.slice(0, 4000) }))
      : [];
    const meeting = (req.body.meeting ?? {}) as MeetingDraft;
    const requestedModel = typeof req.body.model === "string" ? req.body.model : "llama-3.3-70b-versatile";
    const model = session!.models.includes(requestedModel)
      ? requestedModel
      : session!.models.includes("llama-3.3-70b-versatile")
        ? "llama-3.3-70b-versatile"
        : session!.models[0];
    const result = await chatWithGroq(
      session!.apiKey,
      model,
      messages,
      meeting,
      req.body.language === "en" ? "en" : "ko",
    );
    res.json({ ...result, model, complete: validateMeeting(result.meeting).length === 0 });
  } catch (error) {
    next(error);
  }
});

app.get("/api/demo/people", (_req, res) => res.json({ people: demoPeople, label: "데모 데이터" }));

app.get("/api/people", requireSession, async (req, res, next) => {
  try {
    const query = typeof req.query.query === "string" ? req.query.query.slice(0, 100) : "";
    res.json({ people: searchPeople(demoPeople, await provider.listEvents(), query), mode: "demo" });
  } catch (error) {
    next(error);
  }
});

app.post("/api/invitations", requireSession, async (req, res, next) => {
  try {
    const meeting = (req.body.meeting ?? {}) as MeetingDraft;
    const missing = validateMeeting(meeting);
    if (missing.length) return res.status(400).json({ error: `초대 전에 필요한 정보가 있습니다: ${missing.join(", ")}`, code: "invalid_meeting" });
    const requestId = typeof req.body.requestId === "string" ? req.body.requestId.trim().slice(0, 100) : "";
    if (!requestId) return res.status(400).json({ error: "초대 요청 식별자가 필요합니다.", code: "invalid_input" });
    const invitation = await invitationStore.create(meeting, requestId);
    res.status(201).json({
      token: invitation.token,
      links: invitation.participantAccess.map(({ attendee, token: urlToken }) => ({ attendee, urlToken })),
      expiresAt: invitation.expiresAt,
      updatedAt: invitation.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/invitations/:token", async (req, res, next) => {
  try {
    const token = readInvitationToken(req.params.token);
    const access = token ? await invitationStore.getByAccessToken(token) : undefined;
    if (!access) return res.status(404).json({ error: "유효하지 않거나 만료된 초대 링크입니다.", code: "not_found" });
    const { record: invitation, attendee } = access;
    const currentStatus = invitation.availability.find((item) => item.attendee === attendee)?.status ?? "no_response";
    res.json({
      invitation: {
        meeting: {
          ...invitation.meeting,
          attendees: [attendee],
          requiredAttendees: invitation.meeting.requiredAttendees?.filter((name) => name === attendee),
        },
        attendee,
        currentStatus,
        expiresAt: invitation.expiresAt,
        updatedAt: invitation.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

function organizerView(record: NonNullable<Awaited<ReturnType<RoundStore["get"]>>>) {
  return {
    token: record.token,
    version: record.version,
    deadlineAt: record.deadlineAt,
    reminderCount: record.reminderCount,
    updatedAt: record.updatedAt,
    ...summarize(record),
    invitedAt: record.invitedAt,
    participants: record.participants.map((p) => ({ attendee: p.attendee, urlToken: p.token, responded: Boolean(p.respondedAt), delivery: p.delivery ?? "not_sent", deliveryError: p.deliveryError })),
  };
}

async function requireRound(req: Request, res: Response) {
  const token = readInvitationToken(req.params.token);
  const record = token ? await roundStore.get(token) : undefined;
  if (!record) res.status(404).json({ error: "조율을 찾을 수 없어요.", code: "not_found" });
  return record;
}

app.post("/api/rounds", requireSession, async (req, res, next) => {
  try {
    const meeting = (req.body.meeting ?? {}) as MeetingDraft;
    const missing = validateMeeting(meeting);
    if (missing.length) return res.status(400).json({ error: `먼저 필요한 정보가 있어요: ${missing.join(", ")}`, code: "invalid_meeting" });
    const requestId = typeof req.body.requestId === "string" ? req.body.requestId.trim().slice(0, 100) : "";
    if (!requestId) return res.status(400).json({ error: "요청 식별자가 필요해요.", code: "invalid_input" });
    const { required, optional } = splitAttendees(meeting);
    if (!required.length || !optional.length) return res.status(400).json({ error: "필수 참석자와 참여하면 좋은 사람을 모두 정해 주세요.", code: "invalid_meeting" });
    const deadline = Date.parse(String(req.body.deadlineAt));
    if (!Number.isFinite(deadline) || deadline <= Date.now()) return res.status(400).json({ error: "응답 마감은 지금보다 뒤여야 해요.", code: "invalid_input" });
    const candidates = requiredFirstCandidates(meeting, deadline);
    if (!candidates.length) return res.status(400).json({ error: "응답 마감 이후에 필수 참석자가 모두 가능한 시간이 없어요. 마감을 앞당기거나 기간을 넓혀 보세요.", code: "no_candidates" });
    const record = await roundStore.create(meeting, candidates, new Date(deadline).toISOString(), requestId);
    res.status(201).json({ round: organizerView(record) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/rounds/:token", requireSession, async (req, res, next) => {
  try {
    const record = await requireRound(req, res);
    if (record) res.json({ round: organizerView(record) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/rounds/:token/send", requireSession, async (req, res, next) => {
  try {
    const record = await requireRound(req, res);
    if (record) res.json({ round: organizerView(await dispatch(roundStore, mailer, record, "invite", baseUrlOf(req))) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/rounds/:token/refresh", requireSession, async (req, res, next) => {
  try {
    const record = await requireRound(req, res);
    if (!record) return;
    const candidates = requiredFirstCandidates(record.meeting, Date.parse(record.deadlineAt));
    if (!candidates.length) return res.status(400).json({ error: "지금은 필수 참석자가 모두 가능한 시간이 없어요.", code: "no_candidates" });
    res.json({ round: organizerView(await roundStore.refresh(record.token, candidates)) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/rounds/:token/remind", requireSession, async (req, res, next) => {
  try {
    const record = await requireRound(req, res);
    if (!record) return;
    const reminded = await roundStore.remind(record.token);
    res.json({ round: organizerView(await dispatch(roundStore, mailer, reminded, "reminder", baseUrlOf(req))) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/rounds/:token/deadline", requireSession, async (req, res, next) => {
  try {
    const record = await requireRound(req, res);
    if (!record) return;
    res.json({ round: organizerView(await roundStore.extend(record.token, String(req.body.deadlineAt))) });
  } catch (error) {
    if (error instanceof Error && error.message.includes("마감")) return res.status(400).json({ error: error.message, code: "invalid_input" });
    next(error);
  }
});

app.post("/api/rounds/:token/confirm", requireSession, async (req, res, next) => {
  try {
    const record = await requireRound(req, res);
    if (!record) return;
    const requestId = typeof req.body.requestId === "string" ? req.body.requestId.trim().slice(0, 100) : "";
    if (!requestId) return res.status(400).json({ error: "확정 요청 식별자가 필요해요.", code: "invalid_input" });
    const row = summarize(record).rows.find((item) => item.candidate.id === req.body.candidateId);
    const fresh = requiredFirstCandidates(record.meeting, Date.parse(record.deadlineAt)).find((item) => item.id === row?.candidate.id);
    if (!row || !fresh || fresh.start !== row.candidate.start || !fresh.requiredAvailable || Date.parse(fresh.start) <= Date.now()) {
      return res.status(409).json({ error: "확정 직전 필수 참석자의 일정이 바뀌었어요. 후보를 다시 찾아 주세요.", code: "stale_candidate" });
    }
    const { optional } = splitAttendees(record.meeting);
    const candidate: Candidate = {
      ...fresh,
      acceptedCount: row.accepted,
      available: fresh.available + row.accepted,
      unknownCount: row.tentative + row.noResponse,
      unknown: record.participants.filter((p) => p.responses[fresh.id] !== "accepted" && p.responses[fresh.id] !== "declined").map((p) => p.attendee),
      unavailable: record.participants.filter((p) => p.responses[fresh.id] === "declined").map((p) => p.attendee),
    };
    const statusMap = { accepted: "available", declined: "unavailable", tentative: "tentative" } as const;
    const availability: AvailabilityResponse[] = optional.map((attendee) => {
      const status = record.participants.find((p) => p.attendee === attendee)?.responses[fresh.id];
      return status === "accepted"
        ? { attendee, status: "available", start: fresh.start, end: fresh.end }
        : { attendee, status: status ? statusMap[status] : "no_response" };
    });
    const event = await provider.createRoundEvent(record.meeting, candidate, availability, requestId);
    await roundStore.markConfirmed(record.token, { start: fresh.start, end: fresh.end });
    res.status(201).json({ event, mode: "demo", invitationSent: false });
  } catch (error) {
    next(error);
  }
});

app.get("/api/rounds/respond/:token", async (req, res, next) => {
  try {
    const token = readInvitationToken(req.params.token);
    const access = token ? await roundStore.getByAccess(token) : undefined;
    if (!access) return res.status(404).json({ error: "유효하지 않거나 만료된 초대 링크입니다.", code: "not_found" });
    const { record, participant } = access;
    res.json({
      invitation: {
        meeting: { title: record.meeting.title, purpose: record.meeting.purpose, durationMinutes: record.meeting.durationMinutes },
        attendee: participant.attendee,
        candidates: record.candidates.map(({ id, start, end }) => ({ id, start, end })),
        responses: participant.responses,
        version: record.version,
        deadlineAt: record.deadlineAt,
        pastDeadline: Date.now() >= Date.parse(record.deadlineAt),
        confirmed: record.confirmed ? { start: record.confirmed.start, end: record.confirmed.end } : undefined,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/rounds/respond/:token", async (req, res, next) => {
  try {
    const token = readInvitationToken(req.params.token);
    const version = Number(req.body.version);
    if (!token || !Number.isInteger(version) || !req.body.responses || typeof req.body.responses !== "object") {
      return res.status(400).json({ error: "응답 정보를 확인해 주세요.", code: "invalid_input" });
    }
    const record = await roundStore.respond(token, version, req.body.responses as Record<string, unknown>);
    res.json({ saved: true, updatedAt: record.updatedAt });
  } catch (error) {
    if (error instanceof RoundClosedError) return res.status(409).json({ error: error.message, code: "round_closed" });
    next(error);
  }
});

app.get("/api/invitations/:token/availability", requireSession, async (req, res, next) => {
  try {
    const token = readInvitationToken(req.params.token);
    const invitation = token ? await invitationStore.get(token) : undefined;
    if (!invitation) return res.status(404).json({ error: "초대 응답을 찾을 수 없습니다.", code: "not_found" });
    res.json({ availability: invitation.availability, updatedAt: invitation.updatedAt });
  } catch (error) {
    next(error);
  }
});

app.post("/api/invitations/:token/responses", async (req, res, next) => {
  try {
    const token = readInvitationToken(req.params.token);
    const status = req.body.status;
    if (!token || !["available", "unavailable", "tentative"].includes(String(status))) {
      return res.status(400).json({ error: "응답 정보를 확인해 주세요.", code: "invalid_input" });
    }
    const start = typeof req.body.start === "string" && Number.isFinite(Date.parse(req.body.start)) ? req.body.start : undefined;
    const end = typeof req.body.end === "string" && Number.isFinite(Date.parse(req.body.end)) ? req.body.end : undefined;
    if (status === "available" && (!start || !end || Date.parse(start) >= Date.parse(end))) {
      return res.status(400).json({ error: "가능한 시작·종료 시간을 확인해 주세요.", code: "invalid_input" });
    }
    const invitation = await invitationStore.respond(token, status as "available" | "unavailable" | "tentative", start, end);
    res.json({ saved: true, status, updatedAt: invitation.updatedAt });
  } catch (error) {
    next(error);
  }
});

app.post("/api/recommendations", requireSession, async (req, res, next) => {
  try {
    const availability = await resolveAvailability(req.body as Record<string, unknown>);
    const candidates = await provider.getFreeBusy((req.body.meeting ?? {}) as MeetingDraft, availability);
    res.json({ candidates, availability, mode: "manual", checkedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/events", requireSession, async (_req, res, next) => {
  try {
    res.json({ events: await provider.listEvents() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/events/:id", requireSession, async (req, res, next) => {
  try {
    const event = (await provider.listEvents()).find((item) => item.id === String(req.params.id));
    if (!event) return res.status(404).json({ error: "회의를 찾을 수 없습니다.", code: "not_found" });
    res.json({ event });
  } catch (error) {
    next(error);
  }
});

app.post("/api/events", requireSession, async (req, res, next) => {
  try {
    const requestId = typeof req.body.requestId === "string" ? req.body.requestId.trim().slice(0, 100) : "";
    if (!requestId) return res.status(400).json({ error: "확정 요청 식별자가 필요합니다.", code: "invalid_input" });
    const event = await provider.createEvent(
      req.body.meeting as MeetingDraft,
      req.body.candidate as Candidate,
      await resolveAvailability(req.body as Record<string, unknown>),
      requestId,
    );
    res.status(201).json({ event, mode: "demo", invitationSent: false });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/events/:id", requireSession, async (req, res, next) => {
  try {
    const event = await provider.updateEvent(String(req.params.id), req.body.meeting as MeetingDraft);
    res.json({ event, mode: "demo" });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/events/:id", requireSession, async (req, res, next) => {
  try {
    await provider.deleteEvent(String(req.params.id));
    res.json({ cancelled: true, mode: "demo" });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const known = error instanceof UpstreamError;
  const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
  const conflict = error instanceof DraftConflictError;
  const stale = error instanceof RoundStaleError;
  res.status(known ? error.status : conflict || stale ? 409 : 400).json({ error: message, code: known ? error.code : conflict ? "draft_conflict" : stale ? "stale_invitation" : "request_failed" });
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(currentDir, "../dist");
app.use(express.static(distDir));
app.get("/{*path}", (_req, res, next) => {
  if (process.env.NODE_ENV !== "production") return next();
  res.sendFile(path.join(distDir, "index.html"));
});

// 응답 수집 기간의 절반이 지나도 답이 없으면 미응답자에게 재알림을 한 번만 자동 발송한다.
const autoRemind = setInterval(async () => {
  try {
    const now = Date.now();
    for (const record of await roundStore.all()) {
      if (!record.invitedAt || !record.baseUrl || record.reminderCount >= 1 || now >= Date.parse(record.deadlineAt)) continue;
      const halfway = Date.parse(record.invitedAt) + (Date.parse(record.deadlineAt) - Date.parse(record.invitedAt)) / 2;
      if (now < halfway || record.participants.every((p) => p.respondedAt || p.delivery !== "sent")) continue;
      await dispatch(roundStore, mailer, await roundStore.remind(record.token), "reminder", record.baseUrl);
    }
  } catch (error) {
    console.error("auto reminder failed", error);
  }
}, 60 * 1000);
autoRemind.unref();

const cleanup = setInterval(() => {
  const cutoff = Date.now() - sessionTtl;
  for (const [id, session] of sessions) if (session.touchedAt < cutoff) sessions.delete(id);
}, 15 * 60 * 1000);
cleanup.unref();

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log(`NODI server listening on http://localhost:${port}`));
}

export { app };
