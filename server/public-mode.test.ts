import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";
process.env.NODI_MODE = "public";
process.env.GROQ_API_KEY = "gsk_test_not_a_real_key_0000000000000000";
process.env.RATE_LIMIT_PER_MINUTE = "5";
process.env.MAX_INPUT_CHARS = "100";
process.env.OPS_TOKEN = "ops-test-token";
delete process.env.VITE_AMPLITUDE_API_KEY;
process.env.PROTOTYPE_DATA_PATH = path.join(os.tmpdir(), `nodi-proto-${process.pid}.jsonl`);

const SECRET = process.env.GROQ_API_KEY;
const realFetch = globalThis.fetch;
let base = "";
let close = () => {};
let upstream: { url: string; headers: Record<string, string>; body: Record<string, unknown> } | undefined;
let upstreamStatus = 200;
const consoleOutput: string[] = [];

beforeAll(async () => {
  for (const method of ["log", "info", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation((...args) => { consoleOutput.push(args.map(String).join(" ")); });
  const { app } = await import("./index.ts");
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("api.groq.com")) return realFetch(input, init);
    upstream = { url, headers: Object.fromEntries(new Headers(init?.headers).entries()), body: JSON.parse(String(init?.body ?? "{}")) };
    if (upstreamStatus !== 200) return Promise.resolve(Response.json({ error: { message: "internal detail: secret upstream text" } }, { status: upstreamStatus }));
    return Promise.resolve(Response.json({ choices: [{ message: { content: JSON.stringify({ intent: "update_meeting", assistantMessage: "ok", meetingPatch: { durationMinutes: 30 } }) } }] }));
  });
});
afterAll(() => close());

const start = async () => (await fetch(`${base}/api/session/demo`, { method: "POST" })).headers.get("set-cookie")!.split(";")[0];
// 테스트마다 다른 IP로 보내서(프록시 헤더) 서로의 요청 한도에 영향을 주지 않게 해요.
let nextIp = 1;
const chat = (cookie: string, body: object, headers: Record<string, string> = {}) => fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", cookie, "x-forwarded-for": `10.1.0.${nextIp++}`, ...headers }, body: JSON.stringify(body) });
const talk = (text: string) => ({ messages: [{ role: "user", content: text }], meeting: {} });

describe("public prototype: server-side key", () => {
  it("starts without a key, reports status without secrets, and never returns the key", async () => {
    const health = await (await fetch(`${base}/api/health`)).text();
    expect(JSON.parse(health)).toMatchObject({ ok: true, mode: "public", aiConfigured: true, publicDemoEnabled: true, analyticsConfigured: false });
    expect(health).not.toContain("test_amplitude_project_key"); // 키 값은 절대 노출하지 않아요
    expect(health).not.toContain(SECRET!.slice(0, 8));
    const connect = await fetch(`${base}/api/session/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: "gsk_user_supplied" }) });
    expect(connect.status).toBe(403);
  });

  it("calls Groq only from the server with the server key, fixed model and token cap, ignoring client choices", async () => {
    const cookie = await start();
    const res = await chat(cookie, { ...talk("30분으로 해줘"), model: "evil-model", max_tokens: 99999, apiKey: "gsk_attacker" });
    expect(res.status).toBe(200);
    expect(upstream!.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(upstream!.headers.authorization).toBe(`Bearer ${SECRET}`);
    expect(upstream!.body.model).toBe("llama-3.3-70b-versatile");
    expect(upstream!.body.max_tokens).toBe(600);
    const text = await res.text();
    expect(text).not.toContain(SECRET!);
    expect(text).not.toContain("evil-model");
  });

  it("rejects over-long input and an absurd conversation length", async () => {
    const cookie = await start();
    const tooLong = await chat(cookie, talk("가".repeat(101)));
    expect(tooLong.status).toBe(400);
    expect(((await tooLong.json()) as { code: string }).code).toBe("input_too_long");
    const many = await chat(cookie, { messages: Array.from({ length: 201 }, () => ({ role: "user", content: "a" })), meeting: {} });
    expect(many.status).toBe(400);
  });

  it("returns 429 with a Korean message and Retry-After after the per-minute limit", async () => {
    const cookie = await start();
    let last: Response | undefined;
    for (let i = 0; i < 8; i++) { last = await chat(cookie, talk("30분"), { "x-forwarded-for": "10.9.9.9" }); if (last.status === 429) break; }
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get("retry-after"))).toBeGreaterThan(0);
    const body = (await last!.json()) as { error: string; code: string; retryAfterSec: number };
    expect(body.error).toMatch(/[가-힣]/);
    expect(["too_many_requests", "daily_limit"]).toContain(body.code);
  });

  it("hides upstream error text and key problems from users", async () => {
    const cookie = await start();
    upstreamStatus = 500;
    const failed = await chat(cookie, talk("에러 내기"), {});
    upstreamStatus = 200;
    const text = JSON.stringify(await failed.json());
    expect(failed.status).toBeGreaterThanOrEqual(400);
    expect(text).not.toContain("secret upstream text");
    expect(text).toMatch(/[가-힣]/);
    const cookie2 = await start();
    upstreamStatus = 401;
    const unauthorized = await chat(cookie2, talk("키 문제"));
    upstreamStatus = 200;
    const body = (await unauthorized.json()) as { error: string; code: string };
    expect(unauthorized.status).toBe(503);
    expect(body.code).toBe("ai_unavailable");
    expect(body.error).not.toMatch(/API Key|키/);
  });

  it("rejects foreign origins and non-JSON bodies, and hides parse details", async () => {
    const cookie = await start();
    const foreign = await chat(cookie, talk("hi"), { Origin: "https://evil.example" });
    expect(foreign.status).toBe(403);
    const same = await chat(cookie, talk("30분"), { Origin: base });
    expect(same.status).not.toBe(403);
    const text = await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "text/plain", cookie }, body: "hello" });
    expect(text.status).toBe(415);
    const broken = await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: '{"messages": [SECRET_FRAGMENT' });
    expect(broken.status).toBe(400);
    expect(JSON.stringify(await broken.json())).not.toContain("SECRET_FRAGMENT");
  });

  it("exposes usage numbers only to the operator token", async () => {
    expect((await fetch(`${base}/api/ops/usage`)).status).toBe(404);
    expect((await fetch(`${base}/api/ops/usage`, { headers: { "x-ops-token": "wrong" } })).status).toBe(404);
    const ok = await fetch(`${base}/api/ops/usage`, { headers: { "x-ops-token": "ops-test-token" } });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ requestBudget: 1500 });
  });

  it("never writes conversation text or the key to the server log", async () => {
    const cookie = await start();
    const sentinel = "민감한문장_ZXQ9981";
    await chat(cookie, talk(`${sentinel}`));
    expect(consoleOutput.join("\n")).not.toContain(sentinel);
    expect(consoleOutput.join("\n")).not.toContain(SECRET!);
  });

  it("accepts one valid feedback per run, rejects invalid ones, and exposes no way to read them back", async () => {
    const run = "5a1c7d90-1b2e-4c3d-8e4f-0a9b8c7d6e5f";
    const body = { runId: run, overallScore: 5, easeScore: 4, tags: ["too_slow"], comment: "좋았어요", appVersion: "dev", flowVersion: "flow-1", experimentId: "none", experimentVariant: "none", testMode: "fictional_calendar", deviceCategory: "desktop" };
    const send = (payload: object, ip: string) => fetch(`${base}/api/feedback`, { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(payload) });
    expect((await send(body, "10.2.0.1")).status).toBe(201);
    expect((await send(body, "10.2.0.2")).status).toBe(409);
    expect((await send({ ...body, runId: "6b2d8e01-2c3f-4d4e-9f50-1b0c9d8e7f60", overallScore: 9 }, "10.2.0.3")).status).toBe(400);
    expect((await fetch(`${base}/api/feedback`)).status).toBe(404); // GET으로 읽을 수 없어요
  });
});
