import { ApiError } from "./api";
import { analyticsEnabled, capture, type StepName } from "./analytics";
import { anonymousId, readConsent } from "./consent";
import { deviceInfo } from "./device";
import { experimentVariant } from "./experiment";
import { PROTOTYPE } from "./prototype";

// 한 번의 "회의 만들기 흐름"(run)을 추적해서 퍼널 이벤트를 정확히 한 번씩, 알맞은 시점에 보내요.
// run은 메모리에만 있고, 새 대화·확정 후 새 회의를 시작하면 새 run_id가 만들어져요(run_id는 피드백과의 최소 연결 고리예요).
type Run = {
  id: string; startedAt: number; started: boolean; confirmed: boolean; abandoned: boolean; lastStep: StepName;
  steps: Set<StepName>; regenerate: number; recommendationCount: number; errors: Set<string>; fired: Set<string>;
};
const fresh = (): Run => ({ id: crypto.randomUUID(), startedAt: 0, started: false, confirmed: false, abandoned: false, lastStep: "conditions", steps: new Set(), regenerate: 0, recommendationCount: 0, errors: new Set(), fired: new Set() });
let run = fresh();

// 초안을 복원해 이어서 한 경우에는 시작 이벤트 없이 조용히 "시작됨"으로만 표시해요(시작 이벤트가 없는 run이 생길 수 있어요).
const ensureStarted = () => { if (!run.started) { run.started = true; run.startedAt = Date.now(); } };
const once = (key: string, fn: () => void) => { if (run.fired.has(key)) return; run.fired.add(key); if (key !== "start") ensureStarted(); fn(); };
const elapsed = () => (run.startedAt ? Date.now() - run.startedAt : undefined);
export const currentRunId = () => run.id;
export const isRunConfirmed = () => run.confirmed;
export function newRun() { run = fresh(); }

export function reach(step: StepName) { run.lastStep = step; run.steps.add(step); }
const bucket = (n: number) => (n <= 1 ? "1" : n <= 3 ? "2-3" : n <= 10 ? "4-10" : n <= 30 ? "11-30" : "31plus");

export function flowStarted(method: "guided" | "typed") {
  once("start", () => { run.startedAt = Date.now(); run.started = true; reach("conditions"); capture("meeting_flow_started", { start_method: method }, { step: "conditions" }); });
}
export function detailsCompleted(inputMethod: "guided" | "typed" | "mixed") {
  once("details", () => { reach("search"); capture("meeting_details_completed", { input_method: inputMethod }, { step: "conditions", elapsedMs: elapsed() }); });
}
export function participantsConfigured(count: number) {
  once("participants", () => { reach("participants"); capture("participants_configured", { participant_count_bucket: bucket(count) }, { step: "participants", elapsedMs: elapsed() }); });
}
// signature: 같은 후보가 다시 그려질 때 이벤트가 중복되지 않도록 후보 id를 합친 값
export function recommendationsViewed(count: number, signature: string, generationMs: number) {
  once(`rv:${signature}`, () => { reach("recommendations"); run.recommendationCount = count; capture("recommendations_viewed", { recommendation_count: count, generation_ms: Math.round(generationMs) }, { step: "recommendations", elapsedMs: elapsed() }); });
}
export function recommendationSelected(rank: number) {
  ensureStarted();
  reach("confirm");
  capture("recommendation_selected", { recommendation_rank: rank, is_first_recommendation: rank === 1 }, { step: "recommendations", elapsedMs: elapsed() });
}
export function recommendationRegenerated(reason: "refresh" | "conditions_changed" | "no_candidates") {
  ensureStarted();
  run.regenerate += 1;
  capture("recommendation_regenerated", { regenerate_count: run.regenerate, reason }, { step: "recommendations", elapsedMs: elapsed() });
}

export function meetingConfirmed() {
  once("confirmed", () => {
    run.confirmed = true;
    reach("done");
    capture("meeting_confirmed", { total_ms: elapsed() ?? 0, step_count: run.steps.size }, { step: "done", elapsedMs: elapsed() });
    void postSummary(true);
  });
}

// 이탈 판정 규칙: ① "새 대화"로 명시적으로 다시 시작하거나 ② 시작한 뒤 확정하지 않은 채 페이지가 닫힐 때(pagehide).
// 두 번째는 근사치예요(탭을 닫았다가 같은 초안으로 돌아올 수 있어서 실제 이탈보다 많게 잡힐 수 있어요).
export function flowAbandoned(reason: "restart" | "page_hidden") {
  if (!run.started || run.confirmed || run.abandoned) return;
  run.abandoned = true;
  capture("flow_abandoned", { abandon_reason: reason }, { step: run.lastStep, elapsedMs: elapsed() });
  void postSummary(false);
}

const TOKEN = /^[a-z0-9_.+-]{1,48}$/;
// 오류는 메시지·스택이 아니라 미리 정해진 코드만 보내요(코드가 없으면 상태 번호로).
export function errorCodeOf(reason: unknown) {
  if (reason instanceof ApiError) return reason.code && TOKEN.test(reason.code) ? reason.code : `http_${reason.status}`;
  return "unknown";
}
export function flowError(reason: unknown, step: StepName = run.lastStep) {
  const code = errorCodeOf(reason);
  once(`err:${code}:${step}`, () => { run.errors.add(code); capture("prototype_error", { error_code: code }, { step, elapsedMs: elapsed() }); });
}

async function postSummary(completed: boolean) {
  if (!analyticsEnabled() || !run.started) return;
  const id = anonymousId();
  try {
    await fetch("/api/prototype/run", {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "omit",
      body: JSON.stringify({
        runId: run.id, completed, lastStep: run.lastStep, totalMs: Math.round(elapsed() ?? 0), recommendationCount: run.recommendationCount, regenerateCount: run.regenerate,
        errorCodes: [...run.errors].slice(0, 20), appVersion: PROTOTYPE.appVersion, flowVersion: PROTOTYPE.flowVersion, experimentId: PROTOTYPE.experiment.id,
        experimentVariant: id ? experimentVariant(id) : "none", testMode: PROTOTYPE.testMode, deviceCategory: deviceInfo().device_category, consentPolicyVersion: readConsent()?.policyVersion ?? PROTOTYPE.consentPolicyVersion,
      }),
    });
  } catch { /* 요약이 안 가도 사용 흐름에는 영향 없어요 */ }
}
