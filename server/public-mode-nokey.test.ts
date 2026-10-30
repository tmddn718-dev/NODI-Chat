import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.NODE_ENV = "test";
process.env.NODI_MODE = "public";
delete process.env.GROQ_API_KEY;

let base = "";
let close = () => {};
beforeAll(async () => {
  const { app } = await import("./index.ts");
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(() => close());

describe("public prototype without GROQ_API_KEY", () => {
  it("returns a safe setup message and never mentions variable names or values", async () => {
    const cookie = (await fetch(`${base}/api/session/demo`, { method: "POST" })).headers.get("set-cookie")!.split(";")[0];
    const res = await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ messages: [{ role: "user", content: "30분 회의" }], meeting: {} }) });
    const body = (await res.json()) as { error: string; code: string };
    expect(res.status).toBe(503);
    expect(body.code).toBe("ai_not_configured");
    expect(body.error).not.toMatch(/GROQ|gsk_|env/i);
    expect(body.error).toMatch(/[가-힣]/);
  });
});
