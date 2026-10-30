import type { Interpretation, UserIntent } from "./dialogue.ts";
import type { AttendanceEvidence, Candidate, MeetingDraft } from "./types.ts";

// 대화 엔진의 "말하기" 단계. AI는 의도만 해석하고, 사용자에게 보이는 설명·비교·응답 현황·안내 문구는
// 여기서 실제 데이터(추천 후보·응답 상태)로만 만들어요. 데이터에 없는 내용은 말하지 않아요.

// 의도 이름은 명세(대문자 스네이크)와 이전 이름을 모두 받아 하나로 맞춰요.
const INTENT_ALIASES: Record<string, UserIntent> = {
  update_condition: "update_meeting", remove_condition: "remove_attendee", request_recommendation: "search_availability",
  ask_explanation: "explain_recommendation", cancel_flow: "cancel_meeting",
};
export const INTENTS: UserIntent[] = ["create_meeting", "update_meeting", "add_attendee", "remove_attendee", "update_attendee_priority", "update_date_range", "update_time_preference", "search_availability", "explain_recommendation", "compare_candidates", "check_rsvp_status", "confirm_condition", "confirm_meeting", "cancel_meeting", "help", "out_of_scope", "unknown"];
export function normalizeIntent(raw: unknown): UserIntent {
  const key = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const mapped = INTENT_ALIASES[key] ?? key;
  return (INTENTS as string[]).includes(mapped) ? mapped as UserIntent : "unknown";
}

type Counts = { possible: number; waiting: number; conflict: number; unknown: number };
export type CandidateView = {
  start: string;
  requiredOk: boolean;
  requiredNames: string[];
  requiredKinds: AttendanceEvidence[];
  optionalTotal: number;
  optional: Counts;
  waitingNames: string[];
  declinedNames: string[];
  grounded: boolean; // 설명할 근거 데이터가 있는지
};

const slot = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
const hourOf = (iso: string) => Number(new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(new Date(iso)));
const list = (names: string[], shown = 4) => (names.length > shown + 1 ? `${names.slice(0, shown).join(", ")} 외 ${names.length - shown}명` : names.join(", "));

const bucket = (kind: AttendanceEvidence): keyof Counts =>
  kind === "calendar_free" || kind === "direct_available" ? "possible"
    : kind === "no_response" || kind === "tentative" ? "waiting"
    : kind === "calendar_unavailable" ? "unknown" : "conflict";

// 후보 하나의 증거(evidence)로 만든 보기. 필수 참석자와 나머지를 나눠서 세요.
export function viewOfCandidate(candidate: Candidate, requiredNames: string[]): CandidateView {
  const evidence = candidate.evidence ?? [];
  const isRequired = (name: string) => requiredNames.includes(name);
  const optional: Counts = { possible: 0, waiting: 0, conflict: 0, unknown: 0 };
  for (const item of evidence.filter((entry) => !isRequired(entry.attendee))) optional[bucket(item.evidence)] += 1;
  return {
    start: candidate.start,
    requiredOk: candidate.requiredAvailable,
    requiredNames,
    requiredKinds: evidence.filter((entry) => isRequired(entry.attendee)).map((entry) => entry.evidence),
    optionalTotal: evidence.filter((entry) => !isRequired(entry.attendee)).length,
    optional,
    waitingNames: [...candidate.noResponse, ...candidate.tentative].filter((name) => !isRequired(name)),
    declinedNames: candidate.unavailable.filter((name) => !isRequired(name)),
    grounded: evidence.length > 0,
  };
}

// 응답을 받는 중인 라운드의 행. 필수 참석자는 캘린더로, 나머지는 응답으로 확인한 값이에요.
export type RoundRow = { candidate: Candidate; accepted: number; declined: number; tentative: number; noResponse: number; people: { accepted: string[]; declined: string[]; tentative: string[]; noResponse: string[] } };
export function viewOfRow(row: RoundRow, requiredNames: string[]): CandidateView {
  return {
    start: row.candidate.start,
    requiredOk: row.candidate.requiredAvailable,
    requiredNames,
    requiredKinds: (row.candidate.evidence ?? []).filter((entry) => requiredNames.includes(entry.attendee)).map((entry) => entry.evidence),
    optionalTotal: row.accepted + row.declined + row.tentative + row.noResponse,
    optional: { possible: row.accepted, waiting: row.tentative + row.noResponse, conflict: row.declined, unknown: 0 },
    waitingNames: [...row.people.tentative, ...row.people.noResponse],
    declinedNames: row.people.declined,
    grounded: true,
  };
}

// 문장 단위로 만들어서 어순·조사 오류 없이 실제 데이터만 말해요.
function requiredSentence(view: CandidateView) {
  if (!view.requiredNames.length) return "";
  const n = view.requiredNames.length;
  if (!view.requiredOk) return `필수 참석자 ${list(view.requiredNames)}님의 일정이 맞지 않거나 확인되지 않아 확정할 수 없는 시간이에요.`;
  const kinds = view.requiredKinds;
  if (kinds.length && kinds.every((kind) => kind === "direct_available")) return `필수 참석자 ${n}명이 참석 가능하다고 응답했어요.`;
  if (kinds.length && kinds.every((kind) => kind === "calendar_free")) return `필수 참석자 ${n}명의 캘린더에 충돌이 없어요.`;
  return `필수 참석자 ${n}명의 캘린더에 충돌이 없거나 참석 가능하다고 응답했어요.`;
}

function preferenceSentence(view: CandidateView, meeting: MeetingDraft) {
  const pref = meeting.preferredTime;
  if (!pref || pref === "any") return "";
  const hour = hourOf(view.start);
  const label = pref === "morning" ? "오전" : "오후";
  return (pref === "morning" ? hour < 12 : hour >= 13) ? `요청하신 ${label} 시간대에 해당해요.` : `요청하신 ${label} 시간대는 아니에요.`;
}

function optionalSentence(view: CandidateView) {
  if (!view.optionalTotal) return "";
  const { possible, waiting, conflict, unknown } = view.optional;
  const parts = [
    possible ? `일정 충돌이 없거나 가능하다고 응답한 사람은 ${possible}명` : "",
    waiting ? `응답 대기는 ${waiting}명` : "",
    conflict ? `일정이 겹치거나 어렵다고 한 사람은 ${conflict}명` : "",
    unknown ? `일정을 확인할 수 없는 사람은 ${unknown}명` : "",
  ].filter(Boolean);
  return parts.length ? `선택 참석자 ${view.optionalTotal}명 중 ${parts.join(", ")}이에요.` : "";
}

function uncertaintySentences(view: CandidateView) {
  const notes: string[] = [];
  if (view.optional.waiting) notes.push(`응답 대기 ${view.optional.waiting}명은 불참이 아니라 아직 모르는 상태라서 참석 여부가 확정되지는 않았어요.`);
  if (view.optional.unknown) notes.push("일정을 확인할 수 없는 참석자가 있어요.");
  return notes;
}

const NO_BASIS = "현재 이 후보의 상세 추천 근거를 확인할 수 없어요. ‘후보 새로 찾기’로 최신 일정과 응답 상태를 다시 확인해 주세요.";
const ordinal = (text: string) => {
  const words: Array<[RegExp, number]> = [[/첫\s*번째|1\s*번|첫째|처음/, 0], [/두\s*번째|2\s*번|둘째/, 1], [/세\s*번째|3\s*번|셋째/, 2], [/네\s*번째|4\s*번/, 3]];
  return words.find(([pattern]) => pattern.test(text))?.[1];
};

export function explainCandidate(views: CandidateView[], meeting: MeetingDraft, text: string) {
  if (!views.length) return "아직 추천한 후보 시간이 없어요. 조건이 다 모이면 가능한 시간을 찾아서 근거와 함께 보여드릴게요.";
  const index = Math.min(ordinal(text) ?? 0, views.length - 1);
  const view = views[index];
  if (!view.grounded) return NO_BASIS;
  const head = index === 0 ? `${slot(view.start)}을 가장 먼저 추천한 이유는 다음과 같아요.` : `${index + 1}번째 후보(${slot(view.start)})는 이래요.`;
  return [
    head,
    requiredSentence(view),
    preferenceSentence(view, meeting),
    optionalSentence(view),
    ...uncertaintySentences(view),
    view.requiredKinds.includes("calendar_free") || view.optional.possible ? "캘린더가 비어 있다는 것이 참석을 수락했다는 뜻은 아니에요." : "",
    "추천은 참고 정보이고, 최종 결정은 직접 해 주세요.",
  ].filter(Boolean).join(" ");
}

export function compareCandidates(views: CandidateView[], meeting: MeetingDraft) {
  if (views.length < 2) return views.length ? "지금은 비교할 다른 후보가 없어요. 날짜 범위를 넓히거나 조건을 바꾸면 다른 후보를 찾아볼 수 있어요." : "아직 추천한 후보 시간이 없어요. 조건이 다 모이면 후보를 비교해 드릴게요.";
  const shown = views.slice(0, 3);
  if (shown.some((view) => !view.grounded)) return NO_BASIS;
  const lines = shown.map((view, i) => {
    const required = view.requiredNames.length ? (view.requiredOk ? "필수 참석자 모두 가능" : "필수 참석자 확인 필요") : "";
    const pref = meeting.preferredTime && meeting.preferredTime !== "any" ? ((meeting.preferredTime === "morning" ? hourOf(view.start) < 12 : hourOf(view.start) >= 13) ? `요청한 ${meeting.preferredTime === "morning" ? "오전" : "오후"} 시간대` : `${meeting.preferredTime === "morning" ? "오전" : "오후"} 시간대 아님`) : "";
    const optional = view.optionalTotal ? (view.optional.waiting ? `선택 참석자 응답 대기 ${view.optional.waiting}명` : view.optional.conflict ? `선택 참석자 중 ${view.optional.conflict}명 어려움` : "선택 참석자 응답 확인됨") : "";
    return `${i + 1}번 후보 ${slot(view.start)} — ${[required, pref, optional].filter(Boolean).join(" · ") || "현재 확인된 조건 기준"}`;
  });
  const allWaiting = shown.every((view) => view.optional.waiting > 0);
  const tail = allWaiting ? "후보 모두 선택 참석자 일부의 응답이 아직 확인되지 않았어요." : shown.some((view) => view.optional.waiting > 0) ? "후보마다 응답을 기다리는 선택 참석자 수가 달라요." : "";
  return [`후보를 비교해 볼게요. ${lines.join(". ")}.`, tail].filter(Boolean).join(" ");
}

export type RsvpInput = { invited: boolean; total: number; responded: number; pending: string[]; failed: string[]; top?: { accepted: number; declined: number; tentative: number; noResponse: number } };
export function rsvpStatus(input?: RsvpInput) {
  if (!input) return "아직 참석 가능 여부를 확인하는 단계가 아니에요. 선택 참석자가 있으면 후보를 찾은 뒤 후보 시간별로 가능 여부를 물어볼 수 있어요.";
  if (!input.total) return "이 회의에는 응답을 받을 선택 참석자가 없어요.";
  if (!input.invited) return `선택 참석자 ${input.total}명에게 아직 참석 가능 여부 요청을 보내지 않았어요. 정식 회의 초대가 아니라 일정 조율을 위한 확인 요청이에요.`;
  const parts = [`선택 참석자 ${input.total}명 중 ${input.responded}명이 응답했어요.`];
  if (input.pending.length) parts.push(`${list(input.pending)}님은 응답 대기 중이에요. 응답이 없다고 불참으로 보지 않아요.`);
  if (input.failed.length) parts.push(`${list(input.failed)}님은 요청이 전달되지 않아 확인할 수 없어요.`);
  if (input.top) parts.push(`가장 유력한 시간 기준으로 수락 ${input.top.accepted}명, 거절 ${input.top.declined}명, 미정 ${input.top.tentative}명, 응답 대기 ${input.top.noResponse}명이에요.`);
  return parts.join(" ");
}

export const HELP_TEXT = "NODI는 대화로 회의 조건(참석자, 날짜, 시간)을 정하면 캘린더를 바탕으로 가능한 시간을 추천해요. “내일 오후에 김민지, 박준호랑 30분 회의 잡아줘”처럼 말하거나 아래 목록에서 골라 주세요. 추천은 참고 정보이고, 회의 확정은 직접 승인해야 해요.";
export const OUT_OF_SCOPE_TEXT = "NODI는 회의 일정 조율을 도와드려요. 회의 시간, 참석자, 날짜 같은 조건을 말씀해 주시면 반영할게요.";
export const NOT_UNDERSTOOD_TEXT = "입력하신 내용을 회의 조건에 정확히 연결하지 못했어요. 회의 시간, 참석자, 날짜 중 어떤 항목을 변경하고 싶으신가요?";
const CONFIRM_GUARD = "회의 확정은 후보 시간을 고른 뒤 확인 화면에서 직접 승인해야 해요. 지금은 확정하지 않았어요.";
const CANCEL_GUARD = "회의 취소는 ‘내 회의’에서 해당 회의를 열고 ‘회의 취소’를 눌러 확인 단계를 거쳐야 해요. 지금은 아무것도 취소하지 않았어요. 작성 중인 내용을 처음부터 다시 하려면 ‘새 대화’를 눌러 주세요.";

const TIME_LABEL: Record<string, string> = { morning: "오전", afternoon: "오후", any: "시간 제한 없음" };
const day = (iso: string) => `${Number(iso.slice(5, 7))}월 ${Number(iso.slice(8, 10))}일`;

// 바뀐 항목만 정확히 말하고, 나머지는 유지한다고 알려요(AI의 문장 대신 실제 변경 내용으로 만들어요).
export function describeChanges(current: MeetingDraft, next: MeetingDraft, changed: string[]) {
  const parts: string[] = [];
  const names = (a?: string[], b?: string[]) => ({ added: (b ?? []).filter((name) => !(a ?? []).includes(name)), removed: (a ?? []).filter((name) => !(b ?? []).includes(name)) });
  for (const field of changed) {
    if (field === "durationMinutes") parts.push(current.durationMinutes ? `회의 시간을 ${current.durationMinutes}분에서 ${next.durationMinutes}분으로 변경했어요` : `회의 시간을 ${next.durationMinutes}분으로 정했어요`);
    else if (field === "preferredTime" && next.preferredTime) parts.push(next.preferredTime === "any" ? "선호 시간 제한을 없앴어요" : `선호 시간을 ${TIME_LABEL[next.preferredTime]}${next.preferredTime === "morning" ? "으로" : "로"} ${current.preferredTime ? "변경" : "정"}했어요`);
    else if (field === "attendees") {
      const { added, removed } = names(current.attendees, next.attendees);
      if (added.length) parts.push(`${list(added)}님을 참석자에 추가했어요`);
      if (removed.length) parts.push(`${list(removed)}님을 참석자에서 제외했어요`);
    } else if (field === "requiredAttendees") {
      const { added, removed } = names(current.requiredAttendees, next.requiredAttendees);
      const stillIn = removed.filter((name) => (next.attendees ?? []).includes(name));
      if (added.length) parts.push(`${list(added)}님을 필수 참석자로 지정했어요`);
      if (stillIn.length) parts.push(`${list(stillIn)}님을 선택 참석자로 바꿨어요`);
    } else if (field === "dateStart" || field === "dateEnd") {
      if (!parts.some((part) => part.startsWith("탐색 기간"))) parts.push(next.dateStart && next.dateEnd ? `탐색 기간을 ${next.dateStart === next.dateEnd ? day(next.dateStart) : `${day(next.dateStart)}~${day(next.dateEnd)}`}로 ${current.dateStart ? "변경" : "정"}했어요` : `탐색 ${field === "dateStart" ? "시작일" : "종료일"}을 ${day(String(next[field]))}로 정했어요`);
    } else if (field === "title" && next.title) parts.push(`회의 제목을 “${next.title}”(으)로 ${current.title ? "변경" : "정"}했어요`);
    else if (field === "purpose" && next.purpose) parts.push(`회의 목적을 “${next.purpose}”(으)로 ${current.purpose ? "변경" : "정"}했어요`);
  }
  if (!parts.length) return "";
  const hadOthers = (["title", "purpose", "durationMinutes", "attendees", "preferredTime", "dateStart"] as const).some((field) => current[field] !== undefined && !changed.includes(field));
  return `${parts.join(". ")}.${hadOthers ? " 나머지 조건은 그대로 유지할게요." : ""}`;
}

export type ReplyContext = {
  views: CandidateView[];
  rsvp?: RsvpInput;
  text: string;
};

// 사용자에게 보여줄 문장과, 회의 조건을 바꾸지 않는 "답변만" 응답인지를 정해요.
export function buildReply(args: {
  intent: UserIntent;
  interpretation: Pick<Interpretation, "assistantMessage">;
  current: MeetingDraft;
  next: MeetingDraft;
  changedFields: string[];
  hasProposalOrChoice: boolean;
  context: ReplyContext;
}): { message: string; answerOnly: boolean } {
  const { intent, current, next, changedFields, hasProposalOrChoice, context } = args;
  const changeText = describeChanges(current, next, changedFields);
  const answer =
    intent === "explain_recommendation" ? explainCandidate(context.views, next, context.text)
    : intent === "compare_candidates" ? compareCandidates(context.views, next)
    : intent === "check_rsvp_status" ? rsvpStatus(context.rsvp)
    : intent === "help" ? HELP_TEXT
    : intent === "out_of_scope" ? OUT_OF_SCOPE_TEXT
    : intent === "confirm_meeting" ? CONFIRM_GUARD
    : intent === "cancel_meeting" ? CANCEL_GUARD
    : "";
  // 조건을 바꾼 말이 함께 있으면 변경 내용을 먼저 알리고 답변을 이어 붙여요.
  if (changedFields.length) return { message: [changeText, answer].filter(Boolean).join(" "), answerOnly: false };
  if (answer) return { message: answer, answerOnly: true };
  if (hasProposalOrChoice) return { message: args.interpretation.assistantMessage, answerOnly: false };
  return { message: NOT_UNDERSTOOD_TEXT, answerOnly: false };
}
