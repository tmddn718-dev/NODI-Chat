import type { DemoPerson, MeetingDraft } from "./types.ts";

// 자연어 해석(AI) 결과를 그대로 저장하지 않고, 검증한 뒤 상태에 합치고 다음 행동을 정해요. AI는 이해만, 결정은 여기서 해요.
export type Field = "title" | "purpose" | "durationMinutes" | "attendees" | "requiredAttendees" | "preferredTime" | "dateStart" | "dateEnd";
export type UserIntent = "create_meeting" | "update_condition" | "remove_condition" | "request_recommendation" | "confirm_condition" | "confirm_meeting" | "cancel_flow" | "ask_explanation" | "unknown";
export type AmbiguityType = "multiple_meanings" | "unclear_person" | "unclear_group" | "unclear_date" | "unclear_time" | "unclear_duration" | "unclear_requirement" | "conflicting_value" | "missing_reference" | "delegated_decision";
export type AmbiguityOption = { id: string; label: string; patch?: Partial<MeetingDraft> };
export type Ambiguity = { field: Field; rawText: string; reason: string; type?: AmbiguityType; options?: AmbiguityOption[] };
export type NextAction =
  | { type: "ask"; field: Field }
  | { type: "resolve_person"; options: Array<{ id: string; label: string }> }
  | { type: "resolve_ambiguity"; ambiguity: { field: Field; type: AmbiguityType; rawText: string; options: Array<{ id: string; label: string; patch: Partial<MeetingDraft> }> } }
  | { type: "confirm_proposal"; field: Field }
  | { type: "show_review" };
export type Interpretation = {
  intent: UserIntent;
  assistantMessage: string;
  meetingPatch: Partial<MeetingDraft>;
  removeFields: string[];
  proposedFields: Partial<MeetingDraft>;
  ambiguities: Ambiguity[];
};

const FIELDS: Field[] = ["title", "purpose", "durationMinutes", "attendees", "requiredAttendees", "preferredTime", "dateStart", "dateEnd"];
const norm = (value: string) => value.trim().toLocaleLowerCase("ko-KR").replaceAll(" ", "");
const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
export const MIN_DURATION = 15;
export const MAX_DURATION = 480;
export const MAX_ATTENDEES = 50;

// 이름을 디렉터리와 연결해요. 한 명이면 정식 이름으로, 여러 명이면 모호성으로, 없으면 입력한 그대로(외부·미등록) 둬요.
function resolveAttendees(names: string[], people: DemoPerson[]) {
  const resolved: string[] = [];
  const ambiguities: Ambiguity[] = [];
  const groups: string[] = [];
  let askTeam = "";
  for (const raw of names) {
    const key = norm(raw);
    if (!key) continue;
    // "디자인팀"처럼 팀을 말하면 팀원 전체를 제안하고, "팀원들"처럼 어느 팀인지 모르면 팀을 고르게 해요.
    if (/^(팀원들?|팀원전체|팀전체|팀)$/.test(key)) { askTeam = raw; continue; }
    const members = key.endsWith("팀") ? people.filter((person) => person.team && norm(person.team) === key) : [];
    if (members.length) { groups.push(...members.map((person) => person.name)); continue; }
    const exact = people.filter((person) => norm(person.name) === key || norm(person.email) === key);
    const hits = exact.length ? exact : people.filter((person) => norm(person.name).includes(key) || key.includes(norm(person.name)));
    if (hits.length > 1) {
      ambiguities.push({ field: "attendees", rawText: raw, reason: "multiple_people", options: hits.map((person) => ({ id: person.name, label: `${person.name} · ${person.team ?? ""} ${person.title ?? ""}`.trim() })) });
    } else resolved.push(hits[0]?.name ?? (raw.includes("@") ? raw.trim().toLowerCase() : raw.trim()));
  }
  return { attendees: [...new Set(resolved)].slice(0, MAX_ATTENDEES), ambiguities, groups: [...new Set(groups)], askTeam };
}

function clean(raw: Partial<MeetingDraft>, people: DemoPerson[]) {
  const out: Partial<MeetingDraft> = {};
  const ambiguities: Ambiguity[] = [];
  let groups: string[] = [];
  let askTeam = "";
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim().slice(0, 300) : undefined;
  if (text(raw.title)) out.title = text(raw.title);
  if (text(raw.purpose)) out.purpose = text(raw.purpose);
  if (typeof raw.durationMinutes === "number" && raw.durationMinutes >= MIN_DURATION && raw.durationMinutes <= MAX_DURATION) out.durationMinutes = Math.round(raw.durationMinutes);
  if (Array.isArray(raw.attendees)) {
    const result = resolveAttendees(raw.attendees.filter((item): item is string => typeof item === "string"), people);
    out.attendees = result.attendees;
    ambiguities.push(...result.ambiguities);
    groups = result.groups;
    askTeam = result.askTeam;
  }
  if (Array.isArray(raw.requiredAttendees)) out.requiredAttendees = [...new Set(raw.requiredAttendees.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
  if (validDate(raw.dateStart)) out.dateStart = raw.dateStart;
  if (validDate(raw.dateEnd)) out.dateEnd = raw.dateEnd;
  if (raw.preferredTime === "morning" || raw.preferredTime === "afternoon" || raw.preferredTime === "any") out.preferredTime = raw.preferredTime;
  return { out, ambiguities, groups, askTeam };
}

export function applyInterpretation(current: MeetingDraft, interp: Interpretation, people: DemoPerson[], now = new Date()) {
  const { out: patch, ambiguities, groups, askTeam } = clean(interp.meetingPatch, people);
  const teamOptions = askTeam ? [...new Set(people.map((person) => person.team).filter((team): team is string => !!team))].slice(0, 4).map((team) => {
    const members = people.filter((person) => person.team === team).map((person) => person.name);
    return { id: team, label: `${team} (${members.length}명)`, patch: { attendees: [...new Set([...(current.attendees ?? []), ...(patch.attendees ?? []), ...members])] } };
  }) : [];
  if (teamOptions.length >= 2) ambiguities.push({ field: "attendees", rawText: askTeam, reason: "unclear_group", type: "unclear_group", options: teamOptions });
  if (groups.length) patch.attendees = undefined; // 팀 전체는 아래에서 제안으로만 다뤄요.
  if (patch.attendees === undefined) delete patch.attendees;
  const next: MeetingDraft = { ...current, ...patch };
  for (const field of interp.removeFields) if ((FIELDS as string[]).includes(field)) delete (next as Record<string, unknown>)[field];
  // 같은 이름으로 해석할 수 있는 사람이 여럿이면 고를 때까지 목록에 넣지 않아요.
  // 참석자가 바뀌면 필수 참석자는 그 부분집합으로만 유지해요.
  if (next.requiredAttendees) {
    const have = new Set((next.attendees ?? []).map(norm));
    next.requiredAttendees = next.requiredAttendees.filter((name) => have.has(norm(name)));
    // 참석자 없이 AI가 꼭 참석자만 지어낸 경우엔 값을 만들지 않아요.
    if (!next.attendees?.length && current.requiredAttendees === undefined) delete next.requiredAttendees;
  }
  const issues: string[] = [];
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
  for (const key of ["dateStart", "dateEnd"] as const) {
    if (patch[key] && patch[key]! < today) { next[key] = current[key]; issues.push("지난 날짜는 고를 수 없어서 이전 값을 유지했어요."); break; }
  }
  const dropped = (current.requiredAttendees ?? []).filter((name) => next.requiredAttendees && !next.requiredAttendees.includes(name));
  if (dropped.length) issues.push(`${dropped.join(", ")}님이 참석자에서 빠져 꼭 참석 조건도 함께 해제했어요.`);
  if (next.dateStart && next.dateEnd && next.dateStart > next.dateEnd) { delete next.dateEnd; issues.push("종료일이 시작일보다 빨라서 종료일은 다시 정해야 해요."); }

  // 제안값은 확정하지 않아요. 이미 값이 있거나 이번에 사용자가 직접 말한 필드는 제외해요.
  const proposed = clean(interp.proposedFields, people).out;
  for (const field of FIELDS) if (next[field] !== undefined || patch[field] !== undefined || (field === "requiredAttendees" && proposed[field] && !next.attendees?.length)) delete proposed[field];

  if (groups.length) proposed.attendees = [...new Set([...(current.attendees ?? []), ...groups])];
  if ((proposed.attendees?.length ?? 0) > MAX_ATTENDEES) { proposed.attendees = proposed.attendees!.slice(0, MAX_ATTENDEES); issues.push(`한 회의에는 최대 ${MAX_ATTENDEES}명까지 넣을 수 있어서 앞의 ${MAX_ATTENDEES}명만 제안했어요.`); }
  if (Array.isArray(interp.meetingPatch.attendees) && interp.meetingPatch.attendees.length > MAX_ATTENDEES) issues.push(`한 회의에는 최대 ${MAX_ATTENDEES}명까지 넣을 수 있어서 앞의 ${MAX_ATTENDEES}명만 반영했어요.`);
  const changedFields = FIELDS.filter((field) => JSON.stringify(current[field]) !== JSON.stringify(next[field]));
  // AI가 낸 해석 선택지는 patch를 검증해 2~4개만 남기고, patch가 없거나 무효인 선택지는 버려요(직접 입력은 UI가 항상 제공해요).
  const aiAmbiguities = interp.ambiguities.flatMap((item) => {
    const options = (item.options ?? []).slice(0, 4).flatMap((option) => {
      const cleaned = option.patch ? clean(option.patch, people).out : {};
      return Object.keys(cleaned).length && typeof option.label === "string" && option.label.trim() ? [{ id: String(option.id ?? option.label), label: option.label.trim().slice(0, 80), patch: cleaned }] : [];
    });
    return options.length >= 2 ? [{ ...item, type: item.type ?? "multiple_meanings", options }] : [];
  });
  const all = [...ambiguities, ...aiAmbiguities];
  const person = all.find((item) => item.reason === "multiple_people" && item.options?.length);
  const meaning = aiAmbiguities[0] ?? all.find((item) => item.type === "unclear_group");
  const proposedField = FIELDS.find((field) => proposed[field] !== undefined);
  const missing = FIELDS.find((field) => field === "requiredAttendees" ? next.requiredAttendees === undefined : !next[field] || (Array.isArray(next[field]) && !(next[field] as unknown[]).length));
  const nextAction: NextAction = person ? { type: "resolve_person", options: person.options! }
    : meaning ? { type: "resolve_ambiguity", ambiguity: { field: meaning.field, type: meaning.type!, rawText: meaning.rawText, options: meaning.options as Array<{ id: string; label: string; patch: Partial<MeetingDraft> }> } }
    : proposedField ? { type: "confirm_proposal", field: proposedField }
    : missing ? { type: "ask", field: missing }
    : { type: "show_review" };
  return { meeting: next, changedFields, proposedFields: proposed, ambiguities: all, nextAction, issues };
}
