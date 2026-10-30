import { ApiError } from "./api";
import { isAnalyticsEnabled, trackAnalyticsEvent, type CompletedStep, type CountBucket, type InputMethod, type RegenerationReason, type StepName } from "./analytics";
import { anonymousId, readConsent } from "./consent";
import { deviceInfo } from "./device";
import { experimentVariant } from "./experiment";
import { PROTOTYPE } from "./prototype";

// 한 번의 "회의 만들기 흐름"(run)을 추적해서 퍼널 이벤트를 알맞은 시점에 한 번씩 보내요.
// run은 메모리에만 있고, 새 대화·테스트 초기화·확정 후 새 회의를 시작하면 새 run_id가 만들어져요.
// run_id는 우리 서버의 결과 저장소(피드백·흐름 요약)에만 쓰고 Amplitude에는 보내지 않아요(분석 데이터와 자유 의견이 이어지지 않게).
type Run = {
  id: string; startedAt: number; started: boolean; confirmed: boolean; abandoned: boolean; lastStep: StepName; lastCompleted: CompletedStep;
  steps: Set<StepName>; pendingParticipants: { count: number; at: number } | null; requestIndex: number; regenerate: number; recommendationCount: number; errors: Set<string>; fired: Set<string>;
};
const fresh = (): Run => ({ id: crypto.randomUUID(), startedAt: 0, started: false, confirmed: false, abandoned: false, lastStep: "conditions", lastCompleted: "start", steps: new Set(), pendingParticipants: null, requestIndex: 0, regenerate: 0, recommendationCount: 0, errors: new Set(), fired: new Set() });
let run = fresh();

// 초안을 복원해 이어서 한 경우에는 시작 이벤트 없이 조용히 "시작됨"으로만 표시해요(시작 이벤트가 없는 run이 생길 수 있어요).
const ensureStarted = () => { if (!run.started) { run.started = true; run.startedAt = Date.now(); } };
const once = (key: string, fn: () => void) => { if (run.fired.has(key)) return; run.fired.add(key); if (key !== "start") ensureStarted(); fn(); };
const elapsed = () => (run.startedAt ? Math.max(0, Date.now() - run.startedAt) : 0);
export const currentRunId = () => run.id;
export const isRunConfirmed = () => run.confirmed;
export function newRun() { run = fresh(); }

export function reach(step: StepName) { run.lastStep = step; run.steps.add(step); }
const bucket = (n: number): CountBucket => (n <= 1 ? "1" : n <= 3 ? "2-3" : n <= 10 ? "4-10" : n <= 30 ? "11-30" : "31plus");

export function flowStarted(method: InputMethod) {
  once("start", () => { run.startedAt = Date.now(); run.started = true; reach("conditions"); trackAnalyticsEvent("meeting_flow_started", { start_method: method }, { step: "conditions" }); });
}
// 회의 정보(제목·목적·시간)가 모두 정해졌을 때. 퍼널 순서(정보 → 참석자)를 지키려고, 참석자가 먼저 정해졌다면 이 이벤트 바로 뒤에 보내요.
export function detailsCompleted(inputMethod: InputMethod) {
  once("details", () => { run.lastCompleted = "conditions"; reach("participants"); trackAnalyticsEvent("meeting_details_completed", { input_method: inputMethod, elapsed_ms: elapsed() }, { step: "conditions" }); });
  flushParticipants();
}
// 참석자와 필수/선택 구분이 모두 정해졌을 때. 완료 시점의 시간·인원 구간을 기억해 두었다가 순서에 맞춰 한 번만 보내요.
export function participantsConfigured(count: number) {
  if (run.fired.has("participants")) return;
  run.pendingParticipants ??= { count, at: elapsed() };
  if (run.fired.has("details")) flushParticipants();
}
function flushParticipants() {
  const pending = run.pendingParticipants;
  if (!pending) return;
  once("participants", () => { run.lastCompleted = "participants"; reach("search"); trackAnalyticsEvent("participants_configured", { participant_count_bucket: bucket(pending.count), elapsed_ms: pending.at }, { step: "participants" }); });
}
// 추천 요청을 한 번 제출할 때마다 1회(request_index는 이번 흐름에서 몇 번째 요청인지).
export function recommendationsRequested() {
  ensureStarted();
  run.requestIndex += 1;
  trackAnalyticsEvent("recommendations_requested", { request_index: run.requestIndex }, { step: "search" });
}
// 성공한 추천 결과가 화면에 나타날 때. 후보 세트가 같으면(재렌더 등) 한 번만. elapsed_ms는 요청부터 화면에 보이기까지 걸린 시간이에요.
export function recommendationsViewed(count: number, signature: string, generationMs: number) {
  once(`rv:${signature}`, () => { run.lastCompleted = "search"; reach("recommendations"); run.recommendationCount = count; trackAnalyticsEvent("recommendations_viewed", { recommendation_count: count, elapsed_ms: Math.max(0, Math.round(generationMs)) }, { step: "recommendations" }); });
}
export function recommendationSelected(rank: number) {
  ensureStarted();
  run.lastCompleted = "recommendations";
  reach("confirm");
  trackAnalyticsEvent("recommendation_selected", { recommendation_rank: rank, is_first_recommendation: rank === 1 }, { step: "recommendations" });
}
// 재탐색이 "성공했을 때" 호출해요.
export function recommendationRegenerated(reason: RegenerationReason) {
  ensureStarted();
  run.regenerate += 1;
  trackAnalyticsEvent("recommendation_regenerated", { regeneration_count: run.regenerate, reason_category: reason }, { step: "recommendations" });
}

export function meetingConfirmed() {
  once("confirmed", () => {
    run.confirmed = true;
    run.lastCompleted = "confirm";
    reach("done");
    trackAnalyticsEvent("meeting_confirmed", { total_elapsed_ms: elapsed(), regeneration_count: run.regenerate }, { step: "done" });
    void postSummary(true);
  });
}

// 이탈 판정 규칙: ① "새 대화"·테스트 초기화로 명시적으로 다시 시작하거나 ② 시작한 뒤 확정하지 않은 채 페이지가 닫힐 때(pagehide).
// 두 번째는 근사치예요(탭을 닫았다가 같은 초안으로 돌아올 수 있어서 실제 이탈보다 많게 잡힐 수 있어요).
export function flowAbandoned(reason: "restart" | "page_hidden") {
  if (!run.started || run.confirmed || run.abandoned) return;
  run.abandoned = true;
  trackAnalyticsEvent("flow_abandoned", { last_completed_step: run.lastCompleted, elapsed_ms: elapsed(), abandon_reason: reason }, { step: run.lastStep });
  void postSummary(false);
}

const TOKEN = /^[a-z0-9_.+-]{1,48}$/;
// 오류는 메시지·스택이 아니라 미리 정해진 코드만 보내요(코드가 없으면 상태 번호로).
export function errorCodeOf(reason: unknown) {
  if (reason instanceof ApiError) return reason.code && TOKEN.test(reason.code) ? reason.code : `http_${reason.status}`;
  return "unknown";
}
// 사용자가 다시 시도해서 풀 수 있는 오류인지(설정 문제나 점검은 풀 수 없어요).
const UNRECOVERABLE = new Set(["demo_disabled", "ai_not_configured", "ai_unavailable", "not_found", "origin_not_allowed"]);
export function flowError(reason: unknown, step: StepName = run.lastStep) {
  const code = errorCodeOf(reason);
  once(`err:${code}:${step}`, () => { run.errors.add(code); trackAnalyticsEvent("prototype_error", { error_code: code, recoverable: !UNRECOVERABLE.has(code) }, { step }); });
}

// 우리 서버 결과 저장소에 남기는 흐름 요약(Amplitude 이벤트가 아니에요). 동의한 경우에만, 이름·문장 없이 보내요.
async function postSummary(completed: boolean) {
  if (!isAnalyticsEnabled() || !run.started) return;
  const id = anonymousId();
  try {
    await fetch("/api/prototype/run", {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, credentials: "omit",
      body: JSON.stringify({
        runId: run.id, completed, lastStep: run.lastStep, totalMs: Math.round(elapsed()), recommendationCount: run.recommendationCount, regenerateCount: run.regenerate,
        errorCodes: [...run.errors].slice(0, 20), appVersion: PROTOTYPE.appVersion, flowVersion: PROTOTYPE.flowVersion, experimentId: PROTOTYPE.experiment.id,
        experimentVariant: id ? experimentVariant(id) : "none", testMode: PROTOTYPE.testMode, deviceCategory: deviceInfo().device_category, consentPolicyVersion: readConsent()?.policyVersion ?? PROTOTYPE.consentPolicyVersion,
      }),
    });
  } catch { /* 요약이 안 가도 사용 흐름에는 영향 없어요 */ }
}
