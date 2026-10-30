import type { Interpretation } from "./dialogue.ts";
import type { DemoPerson, MeetingDraft } from "./types.ts";

// 체험(데모) 모드의 해석기. LLM이 아니라 정해진 규칙으로 날짜·시간·참석자·제목을 읽어요.
// 사용자가 말한 값만 담고(없는 값을 만들지 않음), 읽지 못한 말은 unknown으로 돌려 안내해요. 검증은 dialogue.ts가 해요.

const DAY_MS = 86_400_000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const kstDate = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
const addDays = (date: string, amount: number) => new Date(Date.parse(`${date}T00:00:00Z`) + amount * DAY_MS).toISOString().slice(0, 10);
const dow = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const weekdayIndex = (ch: string) => WEEKDAYS.indexOf(ch);

const TITLES: Array<[RegExp, string]> = [
  [/주간\s*(회의|미팅)?/, "주간 회의"],
  [/킥오프/, "킥오프 회의"],
  [/스탠드업/, "스탠드업"],
  [/회고/, "회고 회의"],
  [/브레인스토밍|아이디어\s*회의/, "아이디어 회의"],
  [/디자인\s*리뷰/, "디자인 리뷰"],
  [/코드\s*리뷰/, "코드 리뷰"],
  [/1\s*:\s*1|일대일/, "1:1 미팅"],
  [/워크숍|워크샵/, "워크숍"],
  [/인터뷰/, "인터뷰"],
  [/기획\s*(회의|미팅)/, "기획 회의"],
];

type Mention = { name: string; index: number; end: number; person: boolean };

function findMentions(text: string, people: DemoPerson[]): Mention[] {
  const lower = text.toLowerCase();
  const found: Mention[] = [];
  const take = (name: string, aliases: string[], person: boolean) => {
    const hits = aliases.map((alias) => ({ alias, index: lower.indexOf(alias.toLowerCase()) })).filter((hit) => hit.index >= 0 && hit.alias.length >= 2);
    if (!hits.length) return;
    const best = hits.sort((a, b) => b.alias.length - a.alias.length)[0];
    found.push({ name, index: best.index, end: best.index + best.alias.length, person });
  };
  for (const person of people) {
    const aliases = [person.name];
    // 이름만 부르는 별칭은 샘플 직원에게만 써요(조직 구성원 수백 명의 두 글자 이름이 일반 문장과 겹치지 않게).
    if (/^[가-힣]{3}$/.test(person.name) && !/^p\d{3}$/.test(person.id)) aliases.push(person.name.slice(1));
    if (/^[A-Za-z]/.test(person.name)) aliases.push(person.name.split(/\s+/)[0]);
    take(person.name, aliases, true);
  }
  for (const team of new Set(people.map((person) => person.team).filter((team): team is string => Boolean(team)))) take(team, [team], false);
  if (!found.some((item) => !item.person) && /팀원/.test(text)) take("팀원들", ["팀원"], false);
  // 같은 자리를 차지한 항목은 더 긴 쪽만 남겨요(예: "김민지"와 "민지").
  return found.sort((a, b) => a.index - b.index || b.end - a.end).filter((item, i, all) => !all.slice(0, i).some((prev) => prev.end > item.index));
}

function parseDates(text: string, today: string): { dateStart?: string; dateEnd?: string } {
  const monthDay = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (monthDay) {
    const [month, day] = [Number(monthDay[1]), Number(monthDay[2])];
    const year = Number(today.slice(0, 4));
    let date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (Number.isNaN(Date.parse(`${date}T00:00:00Z`)) || month > 12) return {};
    if (date < today) date = `${year + 1}${date.slice(4)}`;
    return { dateStart: date, dateEnd: date };
  }
  const nextMonday = addDays(today, ((8 - dow(today)) % 7) || 7);
  const thisMonday = addDays(today, -((dow(today) + 6) % 7));
  const nextWeekDay = text.match(/다음\s*주\s*(월|화|수|목|금|토|일)요일/);
  if (nextWeekDay) { const d = addDays(nextMonday, (weekdayIndex(nextWeekDay[1]) + 6) % 7); return { dateStart: d, dateEnd: d }; }
  if (/다음\s*주/.test(text)) return { dateStart: nextMonday, dateEnd: addDays(nextMonday, 4) };
  const thisWeekDay = text.match(/이번\s*주\s*(월|화|수|목|금|토|일)요일/);
  if (thisWeekDay) { const d = addDays(thisMonday, (weekdayIndex(thisWeekDay[1]) + 6) % 7); return { dateStart: d, dateEnd: d }; }
  if (/이번\s*주/.test(text)) {
    const friday = addDays(thisMonday, 4);
    const from = addDays(today, 1);
    return from <= friday ? { dateStart: from, dateEnd: friday } : {};
  }
  const relative: Array<[RegExp, number]> = [[/글피/, 3], [/모레/, 2], [/내일/, 1], [/오늘/, 0]];
  for (const [pattern, offset] of relative) if (pattern.test(text)) { const d = addDays(today, offset); return { dateStart: d, dateEnd: d }; }
  const weekday = text.match(/(월|화|수|목|금|토|일)요일/);
  if (weekday) {
    const diff = ((weekdayIndex(weekday[1]) - dow(today) + 7) % 7) || 7;
    const d = addDays(today, diff);
    return { dateStart: d, dateEnd: d };
  }
  return {};
}

function parseDuration(text: string): number | undefined {
  const minutes = text.match(/(\d+)\s*분/);
  if (minutes) return Number(minutes[1]);
  if (/한\s*시간\s*반/.test(text)) return 90;
  const hours = text.match(/(\d+(?:\.5)?)\s*시간/);
  if (hours) return Math.round(Number(hours[1]) * 60);
  const words: Array<[RegExp, number]> = [[/반\s*시간/, 30], [/한\s*시간/, 60], [/두\s*시간/, 120], [/세\s*시간/, 180]];
  return words.find(([pattern]) => pattern.test(text))?.[1];
}

const stripEnding = (text: string) => text.trim().replace(/\s*(으로|로)\s*(할게요?|해줘요?|해요?|할래요?|하자)\s*[.!]?$/, "").replace(/\s*(이에요|예요|이야|입니다)\s*[.!]?$/, "").trim();
const shortDate = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;

export const UNSUPPORTED_HELP = "데모에서는 회의 이름, 시간, 참석자, 날짜를 이해할 수 있어요. 예: “내일 오후에 김민지, 박준호랑 30분 회의 잡아줘”";

export function interpretScenario(raw: string, meeting: MeetingDraft, people: DemoPerson[], now: Date, currentField?: string): Interpretation {
  const text = raw.trim().slice(0, 2000);
  const today = kstDate(now);
  const patch: Partial<MeetingDraft> = {};
  const proposed: Partial<MeetingDraft> = {};
  const parts: string[] = [];

  // 참석자와 필수/선택. 필수·선택을 가리키는 말은 바로 앞에 나온 사람들에게 붙여요(뒤에서부터 이어받음).
  const mentions = findMentions(text, people);
  if (mentions.length) {
    if (/빼|제외/.test(text)) {
      const drop = new Set(mentions.map((m) => m.name));
      patch.attendees = (meeting.attendees ?? []).filter((name) => !drop.has(name));
      patch.requiredAttendees = (meeting.requiredAttendees ?? []).filter((name) => !drop.has(name));
      parts.push(`${[...drop].join(", ")} 제외`);
    } else {
      const kinds: Array<"required" | "optional" | undefined> = [];
      let carried: "required" | "optional" | undefined;
      for (let i = mentions.length - 1; i >= 0; i--) {
        const segment = text.slice(mentions[i].end, mentions[i + 1]?.index ?? text.length);
        const own = /필수|꼭|반드시/.test(segment) ? "required" : /선택|있으면\s*좋|참여하면\s*좋|가능하면/.test(segment) ? "optional" : undefined;
        carried = own ?? carried;
        kinds[i] = carried;
      }
      const names = mentions.map((m) => m.name);
      patch.attendees = [...new Set([...(meeting.attendees ?? []), ...names])];
      const required = mentions.filter((m, i) => m.person && kinds[i] === "required").map((m) => m.name);
      const optional = new Set(mentions.filter((_, i) => kinds[i] === "optional").map((m) => m.name));
      if (kinds.some(Boolean)) patch.requiredAttendees = [...new Set([...(meeting.requiredAttendees ?? []), ...required])].filter((name) => !optional.has(name));
      parts.push(`참석자 ${names.join(", ")}`);
    }
  }

  const duration = parseDuration(text);
  if (duration) { patch.durationMinutes = duration; parts.push(`${duration}분`); }
  else if (/짧게|금방|잠깐|간단히/.test(text)) proposed.durationMinutes = 30;
  else if (/길게|오래/.test(text)) proposed.durationMinutes = 60;

  const dates = parseDates(text, today);
  if (dates.dateStart) {
    Object.assign(patch, dates);
    parts.push(dates.dateStart === dates.dateEnd ? shortDate(dates.dateStart) : `${shortDate(dates.dateStart)}~${shortDate(dates.dateEnd!)}`);
  }

  if (/오전|아침/.test(text)) { patch.preferredTime = "morning"; parts.push("오전"); }
  else if (/오후/.test(text)) { patch.preferredTime = "afternoon"; parts.push("오후"); }
  else if (/상관없|아무\s*때나|언제든/.test(text)) { patch.preferredTime = "any"; parts.push("시간대 무관"); }

  const title = TITLES.find(([pattern]) => pattern.test(text))?.[1];
  if (title) { patch.title = title; parts.push(`제목 ${title}`); }
  const purpose = text.match(/목적은?\s*[:：]?\s*(.{2,60})/)?.[1];
  if (purpose) { patch.purpose = stripEnding(purpose); parts.push(`목적 ${patch.purpose}`); }

  // 방금 물어본 항목에 짧게 직접 답한 경우에는 그 말을 그대로 그 항목의 값으로 써요.
  if (!parts.length && !Object.keys(proposed).length && text.length >= 2 && text.length <= 30 && !/[?？]|해줘|해주세요|알려|추천|뭐|왜|어떻게/.test(text)) {
    if (currentField === "title") { patch.title = stripEnding(text); parts.push(`제목 ${patch.title}`); }
    if (currentField === "purpose") { patch.purpose = stripEnding(text); parts.push(`목적 ${patch.purpose}`); }
  }

  const hasPatch = Object.keys(patch).length > 0;
  const hasProposal = Object.keys(proposed).length > 0;
  const intent: Interpretation["intent"] = hasPatch
    ? (meeting.title || meeting.attendees?.length || meeting.durationMinutes ? "update_meeting" : "create_meeting")
    : /처음부터|그만|취소|리셋/.test(text) ? "cancel_meeting"
    : /왜|이유|근거|어째서/.test(text) ? "explain_recommendation"
    : /비교|차이|다른 후보|대안/.test(text) ? "compare_candidates"
    : /응답|답했|답변|누가 (왔|답)/.test(text) ? "check_rsvp_status"
    : /어떻게|사용법|도움말|뭘 (할|해)|할 수 있/.test(text) ? "help"
    : /확정|진행해|그걸로/.test(text) ? "confirm_meeting"
    : /추천|찾아|잡아/.test(text) ? "search_availability"
    : hasProposal ? "update_meeting" : "unknown";

  const assistantMessage = parts.length
    ? `${parts.join(", ")} 내용을 반영했어요.`
    : hasProposal ? "말씀하신 느낌에 맞춰 제안을 준비했어요."
    : UNSUPPORTED_HELP;

  return { intent, assistantMessage, meetingPatch: patch, removeFields: [], proposedFields: proposed, ambiguities: [] };
}
