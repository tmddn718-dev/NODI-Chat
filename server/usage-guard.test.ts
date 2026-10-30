import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";
import { UsageGuard } from "./usage-guard.ts";

const base = loadConfig({ NODE_ENV: "test" } as NodeJS.ProcessEnv);
const guard = (over: Partial<typeof base> = {}, clock = { now: Date.parse("2026-11-02T03:00:00Z") }) => {
  const logs: string[] = [];
  return { clock, logs, guard: new UsageGuard({ ...base, ...over }, () => clock.now, (line) => logs.push(line)) };
};
const ask = (g: UsageGuard, session = "s1", ip = "1.1.1.1") => g.acquire({ sessionKey: session, ip, inputChars: 100 });

describe("loadConfig", () => {
  it("uses safe defaults and ignores out-of-range or non-numeric values", () => {
    expect(base).toMatchObject({ publicDemoEnabled: true, rateLimitPerMinute: 10, maxInputChars: 500, groqMaxOutputTokens: 600, groqModel: "llama-3.3-70b-versatile" });
    const bad = loadConfig({ RATE_LIMIT_PER_MINUTE: "0", MAX_INPUT_CHARS: "999999", GROQ_MAX_OUTPUT_TOKENS: "abc", GROQ_MODEL: "x y; drop" } as NodeJS.ProcessEnv);
    expect([bad.rateLimitPerMinute, bad.maxInputChars, bad.groqMaxOutputTokens, bad.groqModel]).toEqual([10, 500, 600, "llama-3.3-70b-versatile"]);
    expect(loadConfig({ PUBLIC_DEMO_ENABLED: "false", ALLOWED_ORIGINS: "https://a.example/, https://b.example" } as NodeJS.ProcessEnv)).toMatchObject({ publicDemoEnabled: false, allowedOrigins: ["https://a.example", "https://b.example"] });
  });
});

describe("UsageGuard", () => {
  it("blocks everything with the kill switch", () => {
    const { guard: g } = guard({ publicDemoEnabled: false });
    const result = ask(g);
    expect(result).toMatchObject({ ok: false, status: 503, code: "demo_disabled" });
  });

  it("limits per minute per session and per IP, and recovers", () => {
    const { guard: g, clock } = guard({ rateLimitPerMinute: 2 });
    for (let i = 0; i < 2; i++) { const r = ask(g); expect(r.ok).toBe(true); if (r.ok) r.release(); }
    const blocked = ask(g);
    expect(blocked).toMatchObject({ ok: false, status: 429, code: "too_many_requests" });
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
    // 같은 IP의 다른 세션도 IP 기준으로 막혀요
    expect(ask(g, "other-session")).toMatchObject({ ok: false, code: "too_many_requests" });
    clock.now += 61_000;
    expect(ask(g).ok).toBe(true);
  });

  it("limits per day per session and per IP until the KST day rolls over", () => {
    const { guard: g, clock } = guard({ rateLimitPerMinute: 100, rateLimitPerDayPerSession: 3, rateLimitPerDayPerIp: 4 });
    for (let i = 0; i < 3; i++) { const r = ask(g); if (r.ok) r.release(); }
    expect(ask(g)).toMatchObject({ ok: false, code: "daily_limit" });
    const fourth = ask(g, "new-session"); // 같은 IP의 4번째
    expect(fourth.ok).toBe(true);
    if (fourth.ok) fourth.release();
    expect(ask(g, "another-session")).toMatchObject({ ok: false, code: "daily_limit" });
    clock.now += 24 * 3_600_000;
    expect(ask(g).ok).toBe(true);
  });

  it("stops new AI calls at the daily global budget, warns at thresholds, and resets next day", () => {
    const { guard: g, clock, logs } = guard({ rateLimitPerMinute: 100, rateLimitPerDayPerSession: 100, rateLimitPerDayPerIp: 100, dailyGlobalRequestBudget: 4 });
    for (let i = 0; i < 4; i++) { const r = ask(g, `s${i}`, `ip${i}`); expect(r.ok).toBe(true); if (r.ok) r.release(); }
    const blocked = ask(g, "s9", "ip9");
    expect(blocked).toMatchObject({ ok: false, status: 429, code: "daily_budget_exhausted" });
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(60);
    expect(g.snapshot()).toMatchObject({ requests: 4, requestBudget: 4, budgetExhausted: true });
    expect(logs.filter((line) => line.startsWith("[nodi:budget]")).length).toBe(3); // 50%·80%·100%
    expect(logs.join("\n")).not.toMatch(/s0|ip0/); // 운영 로그에 식별자·입력이 없어요
    clock.now += 24 * 3_600_000;
    expect(ask(g, "s0", "ip0").ok).toBe(true);
  });

  it("limits concurrent AI requests and frees a slot on release (only once)", () => {
    const { guard: g } = guard({ maxConcurrentAiRequests: 2, rateLimitPerMinute: 100 });
    const a = ask(g, "a", "1"); const b = ask(g, "b", "2");
    expect(ask(g, "c", "3")).toMatchObject({ ok: false, code: "busy" });
    if (a.ok) { a.release(); a.release(); }
    expect(g.snapshot().inflight).toBe(1);
    expect(ask(g, "c", "3").ok).toBe(true);
    if (b.ok) b.release();
  });

  it("records an estimated token count, not an exact cost", () => {
    const { guard: g } = guard();
    const r = ask(g);
    if (r.ok) r.release();
    expect(g.snapshot().estimatedTokens).toBe(50 + base.groqMaxOutputTokens);
  });
});
