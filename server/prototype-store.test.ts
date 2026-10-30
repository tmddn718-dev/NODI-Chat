import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createPrototypeStore, FilePrototypeStore, parseFeedback, parseRun, SupabasePrototypeStore } from "./prototype-store.ts";

const shared = { appVersion: "0.1.0+abc1234", flowVersion: "flow-1", experimentId: "none", experimentVariant: "none", testMode: "fictional_calendar", deviceCategory: "mobile" };
const RUN = "0b8d7f12-3c4e-4a55-9a1b-2f6c1d9e8a77";
const feedback = { runId: RUN, overallScore: 4, easeScore: 5, tags: ["input_hard"], comment: "  추천 이유가 잘 보였어요  ", ...shared };

describe("parseFeedback", () => {
  it("accepts a valid submission and trims the comment", () => {
    expect(parseFeedback(feedback)).toMatchObject({ runId: RUN, overallScore: 4, easeScore: 5, tags: ["input_hard"], comment: "추천 이유가 잘 보였어요" });
  });
  it("rejects scores out of range, unknown tags, long comments, wrong test mode and extra shapes", () => {
    expect(parseFeedback({ ...feedback, overallScore: 6 })).toBeUndefined();
    expect(parseFeedback({ ...feedback, easeScore: 2.5 })).toBeUndefined();
    expect(parseFeedback({ ...feedback, tags: ["<script>"] })).toBeUndefined();
    expect(parseFeedback({ ...feedback, comment: "가".repeat(301) })).toBeUndefined();
    expect(parseFeedback({ ...feedback, testMode: "real_calendar" })).toBeUndefined();
    expect(parseFeedback({ ...feedback, runId: "not-a-uuid" })).toBeUndefined();
    expect(parseFeedback(null)).toBeUndefined();
  });
  it("drops unknown fields instead of storing them", () => {
    const parsed = parseFeedback({ ...feedback, email: "a@b.c", name: "홍길동" }) as Record<string, unknown>;
    expect(parsed.email).toBeUndefined();
    expect(parsed.name).toBeUndefined();
  });
});

describe("parseRun", () => {
  const run = { runId: RUN, completed: true, lastStep: "done", totalMs: 120000, recommendationCount: 3, regenerateCount: 1, errorCodes: ["too_many_requests"], consentPolicyVersion: "2026-11-01", ...shared };
  it("accepts a valid summary and rejects free-text error codes or bad steps", () => {
    expect(parseRun(run)).toMatchObject({ completed: true, regenerateCount: 1 });
    expect(parseRun({ ...run, errorCodes: ["Hello World, 김민지"] })?.errorCodes).toEqual([]);
    expect(parseRun({ ...run, lastStep: "somewhere" })).toBeUndefined();
    expect(parseRun({ ...run, totalMs: -1 })).toBeUndefined();
  });
});

describe("stores", () => {
  it("file store appends rows and refuses a second feedback for the same run, even after a restart", async () => {
    const file = path.join(await mkdtemp(path.join(os.tmpdir(), "nodi-proto-")), "r.jsonl");
    const parsed = parseFeedback(feedback)!;
    expect(await new FilePrototypeStore(file).saveFeedback(parsed)).toBe("saved");
    expect(await new FilePrototypeStore(file).saveFeedback(parsed)).toBe("duplicate");
    expect((await readFile(file, "utf8")).trim().split("\n")).toHaveLength(1);
  });

  it("supabase store sends the service key only in server headers, targets the RLS tables, and detects duplicates", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    let rows: unknown[] = [{ run_id: RUN }];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init: init! }); return Response.json(rows); }) as unknown as typeof fetch;
    const store = new SupabasePrototypeStore("https://example.supabase.co/", "service-role-secret", fetcher);
    expect(await store.saveFeedback(parseFeedback(feedback)!)).toBe("saved");
    expect(calls[0].url).toBe("https://example.supabase.co/rest/v1/prototype_feedback?on_conflict=run_id");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer service-role-secret");
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({ run_id: RUN, overall_score: 4, comment: "추천 이유가 잘 보였어요" });
    rows = [];
    expect(await store.saveFeedback(parseFeedback(feedback)!)).toBe("duplicate");
  });

  it("chooses Supabase only when both server variables are present", () => {
    expect(createPrototypeStore({} as NodeJS.ProcessEnv)).toBeInstanceOf(FilePrototypeStore);
    expect(createPrototypeStore({ SUPABASE_URL: "https://x.supabase.co" } as NodeJS.ProcessEnv)).toBeInstanceOf(FilePrototypeStore);
    expect(createPrototypeStore({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" } as NodeJS.ProcessEnv)).toBeInstanceOf(SupabasePrototypeStore);
  });
});
