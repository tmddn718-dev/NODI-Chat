import type { MeetingDraft } from "./types";

export type GuidedChoice = { label: string; message: string; patch: Partial<MeetingDraft> };
export const STAGE_TOTAL = 4;
export const STAGE_TITLES = ["회의 조건 정하기", "가능한 시간 찾기", "추천 시간 결정하기", "회의 확정 및 관리"];
// 입력 단계는 모두 사용자에게는 "회의 조건 정하기" 한 단계예요.
export const stageOf = (_key: string) => 1;

export type GuidedStep = {
  key: "title" | "purpose" | "duration" | "attendees" | "availabilityRule" | "preferredTime" | "dateStart" | "dateEnd";
  number: number;
  total: number;
  title: string;
  question: string;
  inputPlaceholder: string;
  hint?: string;
  choices: GuidedChoice[];
};

const addDays = (date: string, amount: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
};

const displayDate = (date: string, language: "ko" | "en") =>
  new Intl.DateTimeFormat(language === "ko" ? "ko-KR" : "en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00Z`));

function dateChoices(meeting: MeetingDraft, language: "ko" | "en", now: Date) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const nextMonday = addDays(today, ((8 - weekday) % 7) || 7);

  if (!meeting.dateStart) {
    const dates = [addDays(today, 1), addDays(today, 2), nextMonday];
    return dates.map((date, index) => ({
      label: index === 0
        ? (language === "ko" ? `내일 (${displayDate(date, language)})` : `Tomorrow (${displayDate(date, language)})`)
        : index === 1
          ? (language === "ko" ? `모레 (${displayDate(date, language)})` : `In two days (${displayDate(date, language)})`)
          : (language === "ko" ? `다음 주 월요일 (${displayDate(date, language)})` : `Next Monday (${displayDate(date, language)})`),
      message: language === "ko" ? `회의 시작 날짜는 ${date}로 할게.` : `Set the meeting start date to ${date}.`,
      patch: { dateStart: date },
    }));
  }

  const dates = [meeting.dateStart, addDays(meeting.dateStart, 2), addDays(meeting.dateStart, 6)];
  return dates.map((date, index) => ({
    label: index === 0
      ? (language === "ko" ? `시작일과 같은 날 (${displayDate(date, language)})` : `Same day (${displayDate(date, language)})`)
      : index === 1
        ? (language === "ko" ? `3일 범위 (${displayDate(date, language)}까지)` : `Three-day range (until ${displayDate(date, language)})`)
        : (language === "ko" ? `일주일 범위 (${displayDate(date, language)}까지)` : `One-week range (until ${displayDate(date, language)})`),
    message: language === "ko" ? `회의 종료 날짜는 ${date}로 할게.` : `Set the meeting end date to ${date}.`,
    patch: { dateEnd: date },
  }));
}

export function getGuidedStep(meeting: MeetingDraft, language: "ko" | "en", now = new Date()): GuidedStep | null {
  const ko = language === "ko";
  if (!meeting.title) return {
    key: "title", number: 1, total: 8,
    title: ko ? "회의 종류" : "Meeting type",
    question: ko ? "어떤 회의를 잡을까요?" : "What kind of meeting are you planning?",
    inputPlaceholder: ko ? "예: 신규 서비스 출시 준비 회의" : "e.g. New service launch planning",
    choices: ["팀 정기 회의", "프로젝트 킥오프", "업무 리뷰", "1:1 미팅"].map((label) => ({
      label: ko ? label : ({ "팀 정기 회의": "Team sync", "프로젝트 킥오프": "Project kickoff", "업무 리뷰": "Work review", "1:1 미팅": "1:1 meeting" }[label]!),
      message: ko ? `회의 종류는 ${label}야.` : `The meeting type is ${{ "팀 정기 회의": "team sync", "프로젝트 킥오프": "project kickoff", "업무 리뷰": "work review", "1:1 미팅": "1:1 meeting" }[label]}.`,
      patch: { title: ko ? label : ({ "팀 정기 회의": "Team sync", "프로젝트 킥오프": "Project kickoff", "업무 리뷰": "Work review", "1:1 미팅": "1:1 meeting" }[label]!) },
    })),
  };
  if (!meeting.purpose) return {
    key: "purpose", number: 2, total: 8,
    title: ko ? "회의 목적" : "Purpose",
    question: ko ? "무엇을 위한 회의인가요?" : "What should this meeting decide or share?",
    inputPlaceholder: ko ? "예: 출시 일정과 담당 업무 결정" : "e.g. Decide the launch timeline and owners",
    choices: ko
      ? ["진행 상황과 이슈 공유", "일정과 담당 업무 결정", "성과와 다음 계획 리뷰", "피드백과 코칭"]
          .map((label) => ({ label, message: `회의 목적은 ${label}야.`, patch: { purpose: label } }))
      : ["Share progress and blockers", "Decide timeline and owners", "Review outcomes and next steps", "Feedback and coaching"]
          .map((label) => ({ label, message: `The meeting purpose is to ${label.toLowerCase()}.`, patch: { purpose: label } })),
  };
  if (!meeting.durationMinutes) return {
    key: "duration", number: 3, total: 8,
    title: ko ? "회의 시간" : "Duration",
    question: ko ? "얼마나 진행할까요?" : "How long should the meeting be?",
    inputPlaceholder: ko ? "예: 40분 정도 필요해" : "e.g. About 40 minutes",
    choices: [30, 45, 60, 90].map((minutes) => ({
      label: ko ? `${minutes}분` : `${minutes} min`,
      message: ko ? `회의 시간은 ${minutes}분으로 할게.` : `Set the meeting duration to ${minutes} minutes.`,
      patch: { durationMinutes: minutes },
    })),
  };
  if (!meeting.attendees?.length) return {
    key: "attendees", number: 4, total: 8,
    title: ko ? "참석자" : "Attendees",
    question: ko ? "누구와 함께하나요?" : "Who should attend?",
    inputPlaceholder: ko ? "예: 김민지, 박준호, 이소라" : "e.g. Minji, Junho and Sora",
    choices: ko
      ? [
          { label: "김민지, 박준호", message: "참석자는 김민지와 박준호야.", patch: { attendees: ["김민지", "박준호"] } },
          { label: "김민지, 박준호, 이소라", message: "참석자는 김민지, 박준호, 이소라야.", patch: { attendees: ["김민지", "박준호", "이소라"] } },
          { label: "김민지, Alex Morgan", message: "참석자는 김민지와 Alex Morgan이야.", patch: { attendees: ["김민지", "Alex Morgan"] } },
        ]
      : [
          { label: "Minji and Junho", message: "The attendees are Kim Minji and Park Junho.", patch: { attendees: ["Kim Minji", "Park Junho"] } },
          { label: "Minji, Junho and Sora", message: "The attendees are Kim Minji, Park Junho and Lee Sora.", patch: { attendees: ["Kim Minji", "Park Junho", "Lee Sora"] } },
          { label: "Minji and Alex", message: "The attendees are Kim Minji and Alex Morgan.", patch: { attendees: ["Kim Minji", "Alex Morgan"] } },
        ],
  };
  if (meeting.requiredAttendees === undefined) {
    const attendees = meeting.attendees;
    const first = attendees[0];
    return {
      key: "availabilityRule", number: 5, total: 8,
      title: ko ? "꼭 참석할 사람" : "Availability rule",
      question: ko ? "이 회의를 진행하려면 반드시 참석해야 하는 사람은 누구인가요?" : "Whose availability is required to hold the meeting?",
      inputPlaceholder: ko ? "예: 김민지는 꼭 참석해야 해" : "e.g. Minji must be available",
      choices: [
        {
          label: ko ? "모두 꼭 참석" : "Everyone",
          message: ko ? "모두 꼭 참석해야 해." : "Everyone must be available.",
          patch: { requiredAttendees: attendees },
        },
        {
          label: ko ? `${first} 꼭 참석` : `${first} must be available`,
          message: ko ? `${first} 참석은 꼭 필요해.` : `${first} must be available.`,
          patch: { requiredAttendees: [first] },
        },
        {
          label: ko ? "꼭 참석할 사람 없음" : "No required availability",
          message: ko ? "꼭 참석해야 하는 사람은 없어." : "No one is required to be available.",
          patch: { requiredAttendees: [] },
        },
      ],
    };
  }
  if (!meeting.preferredTime) return {
    key: "preferredTime", number: 6, total: 8,
    title: ko ? "선호 시간대" : "Preferred time",
    question: ko ? "언제가 편한가요?" : "Do you have a preferred time of day?",
    inputPlaceholder: ko ? "예: 오후 2시 이후가 좋아" : "e.g. After 2 PM",
    hint: ko ? "선호 시간대가 없다면 날짜 범위 안에서 참석 가능성이 높은 시간을 우선 찾아볼게요." : "With no preference, we'll look for the times most people can attend within the date range.",
    choices: [
      { label: ko ? "오전" : "Morning", message: ko ? "오전 시간을 선호해." : "I prefer the morning.", patch: { preferredTime: "morning" } },
      { label: ko ? "오후" : "Afternoon", message: ko ? "오후 시간을 선호해." : "I prefer the afternoon.", patch: { preferredTime: "afternoon" } },
      { label: ko ? "시간대 무관" : "Any time", message: ko ? "선호 시간대는 없어." : "I have no time preference.", patch: { preferredTime: "any" } },
    ],
  };
  if (!meeting.dateStart) return {
    key: "dateStart", number: 7, total: 8,
    title: ko ? "시작 날짜" : "Start date",
    question: ko ? "일정을 언제부터 찾아볼까요?" : "When should the search begin?",
    inputPlaceholder: ko ? "예: 다음 주 수요일부터" : "e.g. From next Wednesday",
    choices: dateChoices(meeting, language, now),
  };
  if (!meeting.dateEnd) return {
    key: "dateEnd", number: 8, total: 8,
    title: ko ? "종료 날짜" : "End date",
    question: ko ? "어느 날짜까지 후보를 찾을까요?" : "Until what date should NODI search?",
    inputPlaceholder: ko ? "예: 다음 주 금요일까지" : "e.g. Until next Friday",
    choices: dateChoices(meeting, language, now),
  };
  return null;
}

// 직접 입력한 말을 새 값으로 만들지 않고, 챗봇이 제시한 목록 안에서 가장 가까운 선택지를 찾아요.
// exact면 바로 선택하고, 아니면 "추천"으로만 보여줘요. 비슷한 게 없으면 choice 없이 돌려줘요.
export function matchChoice(step: GuidedStep, text: string): { choice?: GuidedChoice; exact: boolean } {
  const norm = (value: string) => value.toLowerCase().replace(/\s+/g, "");
  const typed = norm(text);
  if (!typed) return { exact: false };
  if (step.key === "duration") {
    const minutes = Number(text.match(/\d+/)?.[0]);
    if (!minutes) return { exact: false };
    const best = step.choices.reduce((a, b) => (Math.abs(b.patch.durationMinutes! - minutes) < Math.abs(a.patch.durationMinutes! - minutes) ? b : a));
    return { choice: best, exact: best.patch.durationMinutes === minutes };
  }
  // 말투가 달라도 같은 뜻이면 해당 선택지(순서)로 연결해요.
  const synonyms: Partial<Record<GuidedStep["key"], [RegExp, number][]>> = {
    preferredTime: [[/오전|아침|morning|\bam\b/i, 0], [/오후|저녁|점심|afternoon|\bpm\b/i, 1], [/무관|상관|아무|any/i, 2]],
    availabilityRule: [[/모두|전부|다들|everyone|all/i, 0], [/없|none|\bno\b/i, 2]],
    dateStart: [[/내일|tomorrow/i, 0], [/모레|two days/i, 1], [/다음\s*주|월요일|next/i, 2]],
    dateEnd: [[/같은\s*날|당일|하루|same/i, 0], [/3\s*일|사흘|three/i, 1], [/일주일|1\s*주|주일|week/i, 2]],
  };
  const hit = synonyms[step.key]?.find(([pattern]) => pattern.test(text));
  if (hit && step.choices[hit[1]]) return { choice: step.choices[hit[1]], exact: true };
  const grams = (value: string) => new Set(Array.from({ length: Math.max(value.length - 1, 0) }, (_, i) => value.slice(i, i + 2)));
  let best: GuidedChoice | undefined, bestScore = 0;
  for (const choice of step.choices) {
    const label = norm(choice.label);
    if (label === typed || label.includes(typed) || typed.includes(label)) return { choice, exact: true };
    const have = grams(label);
    const score = [...grams(typed)].filter((gram) => have.has(gram)).length;
    if (score > bestScore) { best = choice; bestScore = score; }
  }
  return { choice: best, exact: false };
}

