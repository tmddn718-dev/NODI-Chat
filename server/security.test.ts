import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { rateLimit } from "./security.ts";

describe("rateLimit", () => {
  it("blocks after the limit with Retry-After and recovers over time", () => {
    vi.useFakeTimers();
    const limiter = rateLimit(2, 60_000);
    const req = { ip: "1.1.1.1" } as Request;
    const out = () => { const res = { set: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() }; return res; };
    const next = vi.fn();
    limiter(req, out() as unknown as Response, next);
    limiter(req, out() as unknown as Response, next);
    const blocked = out();
    limiter(req, blocked as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(2);
    expect(blocked.status).toHaveBeenCalledWith(429);
    expect(blocked.set).toHaveBeenCalledWith("Retry-After", expect.any(String));
    vi.advanceTimersByTime(60_000);
    limiter(req, out() as unknown as Response, next);
    expect(next).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

import { UpstreamError, withRetry } from "./groq.ts";
describe("withRetry", () => {
  it("retries a rate-limit once, but not an invalid key", async () => {
    const flaky = vi.fn().mockRejectedValueOnce(new UpstreamError("x", 502, "rate_limited")).mockResolvedValue("ok");
    expect(await withRetry(flaky, 1)).toBe("ok");
    expect(flaky).toHaveBeenCalledTimes(2);
    const bad = vi.fn().mockRejectedValue(new UpstreamError("key", 401, "groq_error"));
    await expect(withRetry(bad, 1)).rejects.toThrow("key");
    expect(bad).toHaveBeenCalledTimes(1);
  });
});
