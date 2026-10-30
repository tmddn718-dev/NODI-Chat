import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

process.env.NODE_ENV = "test";

let base = "";
let cookie = "";
let close = () => {};
const realFetch = globalThis.fetch;

beforeAll(async () => {
  const { app } = await import("./index.ts");
  const server = app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
  // Groq 모델 목록 호출만 가짜로 응답해서 키 없이 세션을 만들어요.
  vi.stubGlobal("fetch", (input: string | URL | Request, init?: RequestInit) =>
    String(input).includes("api.groq.com") ? Promise.resolve(Response.json({ data: [{ id: "llama-3.3-70b-versatile", active: true }] })) : realFetch(input, init));
  const res = await fetch(`${base}/api/session/connect`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: "test-key-not-real" }) });
  cookie = res.headers.get("set-cookie")!.split(";")[0];
});
afterAll(() => close());

const get = async <T>(path: string) => (await (await fetch(`${base}${path}`, { headers: { cookie } })).json()) as T;
type People = { people: Array<{ name: string; team?: string; department?: string }>; total: number; hasMore: boolean };

describe("directory API", () => {
  it("returns one page by default and continues with offset", async () => {
    const first = await get<People>("/api/people");
    expect(first.people).toHaveLength(30);
    expect(first.hasMore).toBe(true);
    const next = await get<People>("/api/people?limit=30&offset=30");
    expect(next.people[0].name).not.toBe(first.people[0].name);
  });

  it("filters by department and team, and caps the page size", async () => {
    const team = await get<People>("/api/people?department=%EA%B0%9C%EB%B0%9C%EB%B3%B8%EB%B6%80&team=%EB%B0%B1%EC%97%94%EB%93%9C%ED%8C%80&limit=9999");
    expect(team.total).toBe(16);
    expect(team.people.every((person) => person.team === "백엔드팀")).toBe(true);
  });

  it("serves the org tree and requires a session", async () => {
    const tree = await get<{ total: number; departments: unknown[] }>("/api/directory");
    expect(tree.total).toBeGreaterThanOrEqual(100);
    expect(tree.departments.length).toBeGreaterThan(5);
    expect((await realFetch(`${base}/api/directory`)).status).toBe(401);
  });
});
