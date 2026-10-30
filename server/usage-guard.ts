import type { PublicConfig } from "./config.ts";

// 공개 링크가 무제한 Groq 프록시가 되지 않도록 하는 사용량 보호: 킬 스위치 → 전역 일일 예산 → 동시 요청 → 분당(세션·IP) → 일일(세션·IP).
// 모든 값은 프로세스 메모리 기준이라 서버가 재시작되거나 2대 이상이면 한도가 초기화·분산돼요(문서에 적어 둠).
// ponytail: single-instance memory counters, move to Redis/DB when running more than one instance
export type Decision =
  | { ok: true; release: () => void }
  | { ok: false; status: 429 | 503; code: string; message: string; retryAfterSec: number };

const MINUTE = 60_000;
const kstDay = (ms: number) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10);
const secondsToKstMidnight = (ms: number) => Math.max(60, Math.ceil((Date.parse(`${kstDay(ms)}T00:00:00Z`) + 86_400_000 - (ms + 9 * 3_600_000)) / 1000));

export class UsageGuard {
  private inflight = 0;
  private day = "";
  private dayCounts = new Map<string, number>(); // "s:세션", "i:IP" → 오늘 횟수
  private minute = new Map<string, number[]>(); // 키 → 최근 1분의 요청 시각
  private globalRequests = 0;
  private estimatedTokens = 0;
  private blockedToday = 0;
  private warned = new Set<number>();

  constructor(private readonly config: PublicConfig, private readonly now: () => number = Date.now, private readonly log: (line: string) => void = (line) => console.warn(line)) {}

  private rollDay(ms: number) {
    const today = kstDay(ms);
    if (today === this.day) return;
    this.day = today;
    this.dayCounts.clear();
    this.globalRequests = 0;
    this.estimatedTokens = 0;
    this.blockedToday = 0;
    this.warned.clear();
  }

  private deny(status: 429 | 503, code: string, message: string, retryAfterSec: number): Decision {
    this.blockedToday += 1;
    return { ok: false, status, code, message, retryAfterSec };
  }

  acquire({ sessionKey, ip, inputChars = 0 }: { sessionKey: string; ip: string; inputChars?: number }): Decision {
    const ms = this.now();
    this.rollDay(ms);
    const c = this.config;
    if (!c.publicDemoEnabled) return this.deny(503, "demo_disabled", "지금은 테스트를 잠시 쉬고 있어요. 나중에 다시 와 주세요.", 600);
    if (this.globalRequests >= c.dailyGlobalRequestBudget) return this.deny(429, "daily_budget_exhausted", "오늘 준비한 테스트용 AI 사용량을 모두 썼어요. 내일 다시 이용해 주세요.", secondsToKstMidnight(ms));
    if (this.inflight >= c.maxConcurrentAiRequests) return this.deny(429, "busy", "지금 요청이 몰리고 있어요. 잠시 뒤에 다시 시도해 주세요.", 5);

    const sKey = `s:${sessionKey}`;
    const iKey = `i:${ip}`;
    for (const key of [sKey, iKey]) {
      const recent = (this.minute.get(key) ?? []).filter((at) => ms - at < MINUTE);
      this.minute.set(key, recent);
      if (recent.length >= c.rateLimitPerMinute) return this.deny(429, "too_many_requests", "요청이 너무 많아요. 잠시 뒤에 다시 시도해 주세요.", Math.max(1, Math.ceil((MINUTE - (ms - recent[0])) / 1000)));
    }
    if ((this.dayCounts.get(sKey) ?? 0) >= c.rateLimitPerDayPerSession) return this.deny(429, "daily_limit", "오늘 이 테스트에서 쓸 수 있는 횟수를 모두 썼어요. 내일 다시 이용해 주세요.", secondsToKstMidnight(ms));
    if ((this.dayCounts.get(iKey) ?? 0) >= c.rateLimitPerDayPerIp) return this.deny(429, "daily_limit", "오늘 이 네트워크에서 쓸 수 있는 횟수를 모두 썼어요. 내일 다시 이용해 주세요.", secondsToKstMidnight(ms));

    for (const key of [sKey, iKey]) {
      this.minute.get(key)!.push(ms);
      this.dayCounts.set(key, (this.dayCounts.get(key) ?? 0) + 1);
    }
    this.globalRequests += 1;
    // 토큰 수는 정확한 값이 아니라 추정치예요(입력 글자 수 ÷ 2 + 출력 상한). 예산의 대용 지표로만 써요.
    this.estimatedTokens += Math.ceil(inputChars / 2) + c.groqMaxOutputTokens;
    this.inflight += 1;
    this.warnAtThresholds();
    if (this.minute.size > 5000) for (const [key, list] of this.minute) if (!list.some((at) => ms - at < MINUTE)) this.minute.delete(key);
    let released = false;
    return { ok: true, release: () => { if (!released) { released = true; this.inflight -= 1; } } };
  }

  // 운영 로그에는 사용자 입력이 아니라 숫자와 상태만 남겨요.
  private warnAtThresholds() {
    const ratio = this.globalRequests / this.config.dailyGlobalRequestBudget;
    for (const level of [0.5, 0.8, 1]) {
      if (ratio >= level && !this.warned.has(level)) {
        this.warned.add(level);
        this.log(`[nodi:budget] ${Math.round(level * 100)}% of daily request budget (${this.globalRequests}/${this.config.dailyGlobalRequestBudget})${level >= 1 ? " — new AI calls are blocked until KST midnight" : ""}`);
      }
    }
  }

  snapshot() {
    this.rollDay(this.now());
    return {
      day: this.day,
      publicDemoEnabled: this.config.publicDemoEnabled,
      requests: this.globalRequests,
      requestBudget: this.config.dailyGlobalRequestBudget,
      estimatedTokens: this.estimatedTokens,
      blockedRequests: this.blockedToday,
      inflight: this.inflight,
      budgetExhausted: this.globalRequests >= this.config.dailyGlobalRequestBudget,
    };
  }
}
