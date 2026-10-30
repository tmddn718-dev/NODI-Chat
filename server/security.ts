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

// 브라우저가 보낸 상태 변경 요청(POST/PUT/PATCH/DELETE)은 같은 출처이거나 허용 목록의 출처일 때만 받아요.
// 개발 환경에서만 localhost를 허용해요. Origin이 없는 요청(서버끼리·curl)은 브라우저 CSRF가 아니라서 통과시켜요.
export function originGuard({ allowed, production }: { allowed: string[]; production: boolean }) {
  const local = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
  return (req: Request, res: Response, next: NextFunction) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
    const origin = req.get("origin");
    if (!origin) return next();
    let host = "";
    try { host = new URL(origin).host; } catch { /* 잘못된 Origin은 아래에서 거절 */ }
    const normalized = origin.replace(/\/$/, "");
    if ((host && host === req.get("host")) || allowed.includes(normalized) || (!production && local.test(normalized))) return next();
    res.status(403).json({ error: "허용되지 않은 요청 출처예요.", code: "origin_not_allowed" });
  };
}

// 본문이 있는 API 요청은 JSON만 받아요(다른 형식으로 우회하는 범용 프록시 사용을 막아요).
export function jsonOnly(req: Request, res: Response, next: NextFunction) {
  const hasBody = Number(req.get("content-length") ?? 0) > 0 || Boolean(req.get("transfer-encoding"));
  if (["POST", "PUT", "PATCH"].includes(req.method) && hasBody && !req.is("application/json")) {
    res.status(415).json({ error: "JSON 형식의 요청만 받아요.", code: "unsupported_media_type" });
    return;
  }
  next();
}
