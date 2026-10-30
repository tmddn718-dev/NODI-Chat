import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

// 공개 테스트의 "구조화된 결과"(흐름 요약·피드백) 저장소. 사용자 행동 이벤트는 PostHog가 맡고, 여기에는 필요한 것만 둬요.
// 이 프로젝트에는 기존 DB가 없어서(데이터는 JSON 파일) Render 재시작·재배포에 안전하지 않아요.
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY(서버 환경변수)를 설정하면 Supabase(RLS 켠 테이블)에 저장하고, 없으면 로컬 파일에 저장해요.
export type RunSummary = {
  runId: string; completed: boolean; lastStep: string; totalMs: number; recommendationCount: number; regenerateCount: number; errorCodes: string[];
  appVersion: string; flowVersion: string; experimentId: string; experimentVariant: string; testMode: string; deviceCategory: string; consentPolicyVersion: string;
};
export type Feedback = {
  runId: string; overallScore: number; easeScore: number; tags: string[]; comment?: string;
  appVersion: string; flowVersion: string; experimentId: string; experimentVariant: string; testMode: string; deviceCategory: string;
};

export const FEEDBACK_TAGS = ["input_hard", "participants_hard", "recommendation_unclear", "confirm_unclear", "too_slow", "mobile_hard", "other"] as const;
export const COMMENT_MAX = 300;
const STEPS = ["consent", "conditions", "participants", "search", "recommendations", "confirm", "feedback", "done"];
const DEVICES = ["mobile", "tablet", "desktop"];
const token = (value: unknown, max = 48) => (typeof value === "string" && /^[A-Za-z0-9_.+-]{1,48}$/.test(value) && value.length <= max ? value : undefined);
const score = (value: unknown) => (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 5 ? (value as number) : undefined);
const RUN_ID = /^[a-f0-9-]{36}$/;

function common(input: Record<string, unknown>) {
  const appVersion = token(input.appVersion);
  const flowVersion = token(input.flowVersion);
  const experimentId = token(input.experimentId);
  const experimentVariant = token(input.experimentVariant);
  const deviceCategory = typeof input.deviceCategory === "string" && DEVICES.includes(input.deviceCategory) ? input.deviceCategory : undefined;
  if (!appVersion || !flowVersion || !experimentId || !experimentVariant || !deviceCategory || input.testMode !== "fictional_calendar") return undefined;
  return { appVersion, flowVersion, experimentId, experimentVariant, deviceCategory, testMode: "fictional_calendar" };
}

export function parseFeedback(body: unknown): Feedback | undefined {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const shared = common(input);
  const overallScore = score(input.overallScore);
  const easeScore = score(input.easeScore);
  const tags = Array.isArray(input.tags) ? [...new Set(input.tags)] : [];
  if (!shared || !overallScore || !easeScore || typeof input.runId !== "string" || !RUN_ID.test(input.runId)) return undefined;
  if (tags.length > FEEDBACK_TAGS.length || !tags.every((tag): tag is string => typeof tag === "string" && (FEEDBACK_TAGS as readonly string[]).includes(tag))) return undefined;
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  if (comment.length > COMMENT_MAX) return undefined;
  return { runId: input.runId, overallScore, easeScore, tags, ...(comment ? { comment } : {}), ...shared };
}

export function parseRun(body: unknown): RunSummary | undefined {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const shared = common(input);
  const consentPolicyVersion = token(input.consentPolicyVersion);
  const errorCodes = Array.isArray(input.errorCodes) ? input.errorCodes.filter((code): code is string => Boolean(token(code))).slice(0, 20) : [];
  const int = (value: unknown, max: number) => (Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max ? (value as number) : undefined);
  const totalMs = int(input.totalMs, 24 * 3_600_000);
  const recommendationCount = int(input.recommendationCount, 1000);
  const regenerateCount = int(input.regenerateCount, 1000);
  if (!shared || !consentPolicyVersion || totalMs === undefined || recommendationCount === undefined || regenerateCount === undefined || typeof input.runId !== "string" || !RUN_ID.test(input.runId) || typeof input.completed !== "boolean") return undefined;
  if (typeof input.lastStep !== "string" || !STEPS.includes(input.lastStep)) return undefined;
  return { runId: input.runId, completed: input.completed, lastStep: input.lastStep, totalMs, recommendationCount, regenerateCount, errorCodes, consentPolicyVersion, ...shared };
}

export interface PrototypeStore {
  saveRun(run: RunSummary): Promise<void>;
  saveFeedback(feedback: Feedback): Promise<"saved" | "duplicate">;
}

// 로컬·개발용: JSON 줄 파일(gitignore 대상). 재시작에도 중복 판정이 유지되도록 파일에서 runId를 읽어요.
export class FilePrototypeStore implements PrototypeStore {
  private seen?: Set<string>;
  constructor(private readonly filePath = process.env.PROTOTYPE_DATA_PATH ?? path.resolve("data/prototype-results.jsonl")) {}
  private async feedbackIds() {
    if (this.seen) return this.seen;
    this.seen = new Set();
    try {
      for (const line of (await readFile(this.filePath, "utf8")).split("\n")) if (line) { const row = JSON.parse(line) as { type: string; runId: string }; if (row.type === "feedback") this.seen.add(row.runId); }
    } catch { /* 파일이 아직 없어요 */ }
    return this.seen;
  }
  private async append(row: object) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await appendFile(this.filePath, `${JSON.stringify({ ...row, at: new Date().toISOString() })}\n`, { mode: 0o600 });
  }
  async saveRun(run: RunSummary) { await this.append({ type: "run", ...run }); }
  async saveFeedback(feedback: Feedback) {
    const seen = await this.feedbackIds();
    if (seen.has(feedback.runId)) return "duplicate";
    seen.add(feedback.runId);
    await this.append({ type: "feedback", ...feedback });
    return "saved";
  }
}

// 운영용: Supabase REST. service-role 키는 서버에서만 쓰고, 테이블은 RLS가 켜져 있어 익명 클라이언트가 접근할 수 없어요.
export class SupabasePrototypeStore implements PrototypeStore {
  constructor(private readonly url: string, private readonly serviceKey: string, private readonly fetcher: typeof fetch = fetch) {}
  private async post(table: string, query: string, prefer: string, row: object) {
    const response = await this.fetcher(`${this.url.replace(/\/$/, "")}/rest/v1/${table}${query}`, {
      method: "POST",
      headers: { apikey: this.serviceKey, Authorization: `Bearer ${this.serviceKey}`, "Content-Type": "application/json", Prefer: prefer },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("저장소에 기록하지 못했어요.");
    return response;
  }
  async saveRun(run: RunSummary) {
    await this.post("prototype_runs", "?on_conflict=run_id", "resolution=merge-duplicates,return=minimal", {
      run_id: run.runId, completed: run.completed, last_step: run.lastStep, total_ms: run.totalMs, recommendation_count: run.recommendationCount, regenerate_count: run.regenerateCount,
      error_codes: run.errorCodes, app_version: run.appVersion, flow_version: run.flowVersion, experiment_id: run.experimentId, experiment_variant: run.experimentVariant,
      test_mode: run.testMode, device_category: run.deviceCategory, consent_policy_version: run.consentPolicyVersion,
    });
  }
  async saveFeedback(f: Feedback) {
    const response = await this.post("prototype_feedback", "?on_conflict=run_id", "resolution=ignore-duplicates,return=representation", {
      run_id: f.runId, overall_score: f.overallScore, ease_score: f.easeScore, tags: f.tags, comment: f.comment ?? null,
      app_version: f.appVersion, flow_version: f.flowVersion, experiment_id: f.experimentId, experiment_variant: f.experimentVariant, test_mode: f.testMode, device_category: f.deviceCategory,
    });
    const rows = (await response.json().catch(() => [])) as unknown[];
    return rows.length ? "saved" : "duplicate";
  }
}

export function createPrototypeStore(env: NodeJS.ProcessEnv = process.env): PrototypeStore {
  const url = env.SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? new SupabasePrototypeStore(url, key) : new FilePrototypeStore();
}
