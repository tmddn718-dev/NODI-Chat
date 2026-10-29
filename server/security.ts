import type { NextFunction, Request, Response } from "express";

// 보안 헤더. 정적 화면과 API 모두에 적용해요.
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer", // 초대 링크 토큰이 Referer로 새지 않게 해요.
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
  next();
}

// 요청 제한(token bucket). 프로세스 메모리 기준이라 서버가 여러 대면 공유 저장소(Redis)로 옮겨야 해요.
// ponytail: single-instance memory buckets, move to Redis when running more than one instance
export function rateLimit(limit: number, windowMs: number, keyOf: (req: Request) => string = (req) => req.ip ?? "unknown") {
  const buckets = new Map<string, { tokens: number; at: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = keyOf(req);
    const bucket = buckets.get(key) ?? { tokens: limit, at: now };
    bucket.tokens = Math.min(limit, bucket.tokens + ((now - bucket.at) / windowMs) * limit);
    bucket.at = now;
    if (bucket.tokens < 1) {
      res.set("Retry-After", String(Math.ceil(((1 - bucket.tokens) * windowMs) / limit / 1000)));
      res.status(429).json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.", code: "too_many_requests" });
      return;
    }
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    if (buckets.size > 5000) for (const [id, value] of buckets) if (now - value.at > windowMs) buckets.delete(id);
    next();
  };
}
