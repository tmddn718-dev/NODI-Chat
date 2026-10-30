import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODI_MODE = "demo";
process.env.NODE_ENV = "test";

let base = "";
let close = () => {};
const outbound: string[] = [];
const realFetch = globalThis.fetch;

beforeAll(async () => {
  const { app } = await import("./index.ts");
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith(base)) outbound.push(url);
    return realFetch(input, init);
  });
});
afterAll(() => close());

const post = (path: string, body: object, cookie = "") => fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify(body) });
const start = async () => (await post("/api/session/demo", {})).headers.get("set-cookie")!.split(";")[0];

describe("demo mode", () => {
  it("reports its mode and refuses API keys", async () => {
    expect(((await (await fetch(`${base}/api/health`)).json()) as { mode: string }).mode).toBe("demo");
    const res = await post("/api/session/connect", { apiKey: "gsk_" + "x".repeat(30) });
    expect(res.status).toBe(403);
  });

  it("starts without a key, understands free text, and never calls an outside host", async () => {
    const cookie = await start();
    const res = await post("/api/chat", { messages: [{ role: "user", content: "내일 오후에 김민지랑 30분 회의" }], meeting: {} }, cookie);
    const body = (await res.json()) as { meeting: { attendees: string[]; durationMinutes: number } };
    expect(res.status).toBe(200);
    expect(body.meeting.attendees).toEqual(["김민지"]);
    expect(body.meeting.durationMinutes).toBe(30);
    expect(outbound).toEqual([]);
  });

  it("requires a started session", async () => {
    expect((await post("/api/chat", { messages: [{ role: "user", content: "안녕" }] })).status).toBe(401);
  });

  it("gives each visitor an empty, separate meeting list", async () => {
    const a = await start();
    const b = await start();
    const events = async (cookie: string) => ((await (await fetch(`${base}/api/events`, { headers: { cookie } })).json()) as { events: unknown[] }).events;
    expect(await events(a)).toEqual([]);
    expect(await events(b)).toEqual([]);
  });
});
