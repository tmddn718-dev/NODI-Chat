import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import { demoPeople } from "./demo-data.ts";
import { DemoCalendarProvider } from "./demo-provider.ts";
import { chatWithGroq, listModels, UpstreamError } from "./groq.ts";
import { validateMeeting } from "./recommendation.ts";
import type { Candidate, MeetingDraft } from "./types.ts";

const app = express();
const port = Number(process.env.PORT) || 3001;
const sessionCookie = "nodi_session";
const sessionTtl = 4 * 60 * 60 * 1000;
const sessions = new Map<string, { apiKey: string; models: string[]; touchedAt: number }>();
const provider = new DemoCalendarProvider();

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
    sessions.set(id, { apiKey, models, touchedAt: Date.now() });
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

app.post("/api/recommendations", async (req, res, next) => {
  try {
    const candidates = await provider.getFreeBusy((req.body.meeting ?? {}) as MeetingDraft);
    res.json({ candidates, mode: "demo", checkedAt: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
});

app.post("/api/events", async (req, res, next) => {
  try {
    const event = await provider.createEvent(req.body.meeting as MeetingDraft, req.body.candidate as Candidate);
    res.status(201).json({ event, mode: "demo", invitationSent: false });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/events/:id", async (req, res, next) => {
  try {
    const event = await provider.updateEvent(req.params.id, req.body.meeting as MeetingDraft);
    res.json({ event, mode: "demo" });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/events/:id", async (req, res, next) => {
  try {
    await provider.deleteEvent(req.params.id);
    res.json({ cancelled: true, mode: "demo" });
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const known = error instanceof UpstreamError;
  const message = error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
  res.status(known ? error.status : 400).json({ error: message, code: known ? error.code : "request_failed" });
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(currentDir, "../dist");
app.use(express.static(distDir));
app.get("/{*path}", (_req, res, next) => {
  if (process.env.NODE_ENV !== "production") return next();
  res.sendFile(path.join(distDir, "index.html"));
});

const cleanup = setInterval(() => {
  const cutoff = Date.now() - sessionTtl;
  for (const [id, session] of sessions) if (session.touchedAt < cutoff) sessions.delete(id);
}, 15 * 60 * 1000);
cleanup.unref();

if (process.env.NODE_ENV !== "test") {
  app.listen(port, () => console.log(`NODI server listening on http://localhost:${port}`));
}

export { app };
