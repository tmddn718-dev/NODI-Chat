import { demoPeople } from "./demo-data.ts";
import type { CalendarBlock, DemoPerson } from "./types.ts";

// 100~500명 규모 회사를 가정한 가상 조직. 같은 기준일이면 항상 같은 결과가 나와요(시드 난수).
// 실제 회사의 디렉터리·공유 캘린더로 바꿀 때는 DemoPerson[]을 돌려주는 부분만 교체하면 돼요.
const DEPARTMENTS: Array<[string, Array<[string, number]>]> = [
  ["개발본부", [["프론트엔드팀", 12], ["백엔드팀", 16], ["모바일팀", 10], ["인프라팀", 8], ["QA팀", 8]]],
  ["제품본부", [["제품기획팀", 12], ["사용자리서치팀", 6], ["서비스운영팀", 10]]],
  ["디자인본부", [["브랜드디자인팀", 8], ["프로덕트디자인팀", 12], ["디자인시스템팀", 6]]],
  ["마케팅본부", [["퍼포먼스마케팅팀", 10], ["콘텐츠팀", 8], ["브랜드마케팅팀", 8]]],
  ["영업본부", [["기업영업팀", 16], ["파트너십팀", 8], ["영업지원팀", 8]]],
  ["경영지원본부", [["인사팀", 8], ["재무팀", 10], ["법무팀", 4], ["총무팀", 6], ["구매팀", 4]]],
  ["데이터본부", [["데이터분석팀", 10], ["ML팀", 8], ["BI팀", 6]]],
  ["고객경험본부", [["고객지원팀", 16], ["고객성공팀", 10], ["품질관리팀", 6]]],
];
// 샘플 5명이 속한 팀은 이 부서에 둬요(팀 이름은 그대로).
const SAMPLE_DEPARTMENT: Record<string, string> = { 프로덕트팀: "제품본부", 개발팀: "개발본부", 디자인팀: "디자인본부", 마케팅팀: "마케팅본부" };

const SURNAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"];
const FIRST = ["서", "지", "민", "하", "도", "예", "수", "현", "유", "승", "재", "은", "태", "나", "주", "선", "시", "채", "가", "건"];
const SECOND = ["연", "우", "진", "윤", "아", "준", "영", "빈", "원", "안", "린", "호", "솔", "찬", "율", "담", "온", "결", "휘", "람"];
const ROLES: Record<string, string[]> = {
  개발본부: ["소프트웨어 엔지니어", "시니어 엔지니어", "테크 리드"], 제품본부: ["프로덕트 매니저", "시니어 매니저", "프로덕트 오너"],
  디자인본부: ["디자이너", "시니어 디자이너", "디자인 리드"], 마케팅본부: ["마케터", "시니어 마케터", "마케팅 리드"],
  영업본부: ["영업 담당", "시니어 영업", "영업 리드"], 경영지원본부: ["매니저", "시니어 매니저", "파트 리더"],
  데이터본부: ["데이터 분석가", "시니어 분석가", "데이터 리드"], 고객경험본부: ["상담 매니저", "시니어 매니저", "CX 리드"],
};
const MEETING_TITLES = ["팀 미팅", "1:1", "고객 미팅", "스프린트 리뷰", "기획 논의", "집중 업무", "교육", "파트너 싱크"];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const addDays = (date: string, amount: number) => new Date(Date.parse(`${date}T00:00:00Z`) + amount * 86_400_000).toISOString().slice(0, 10);
const isWeekday = (date: string) => ![0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const block = (date: string, from: number, to: number, title: string): CalendarBlock => ({ start: `${date}T${hhmm(from)}:00+09:00`, end: `${date}T${hhmm(to)}:00+09:00`, title });

export function generateOrg(baseDate: string, days = 28): DemoPerson[] {
  const taken = new Set(demoPeople.map((person) => person.name));
  const names: string[] = [];
  for (let i = 0; names.length < 400; i++) {
    const name = `${SURNAMES[i % SURNAMES.length]}${FIRST[(i * 7 + Math.floor(i / 20)) % FIRST.length]}${SECOND[(i * 3 + Math.floor(i / 7)) % SECOND.length]}`;
    if (!taken.has(name)) { taken.add(name); names.push(name); }
  }
  const dates = Array.from({ length: days }, (_, i) => addDays(baseDate, i)).filter(isWeekday);
  const people: DemoPerson[] = [];
  let n = 0;
  for (const [department, teams] of DEPARTMENTS) {
    for (const [team, size] of teams) {
      const teamRandom = rng(1000 + people.length);
      // 팀 전체가 같이 잡혀 있는 정기 회의(월·수 오전 스탠드업).
      const standupMinutes = 9 * 60 + 30 + Math.floor(teamRandom() * 4) * 30;
      for (let k = 0; k < size; k++, n++) {
        const random = rng(7 + n * 31);
        const roles = ROLES[department];
        const title = k === 0 ? roles[2] : k < 4 ? roles[1] : roles[0];
        const blocks: CalendarBlock[] = [];
        const leave: string[] = [];
        if (random() < 0.12) { const from = Math.floor(random() * Math.max(1, dates.length - 3)); leave.push(...dates.slice(from, from + 1 + Math.floor(random() * 3))); }
        for (const date of dates) {
          if (leave.includes(date)) continue;
          const day = new Date(`${date}T00:00:00Z`).getUTCDay();
          if (day === 1 || day === 3) blocks.push(block(date, standupMinutes, standupMinutes + 30, "팀 스탠드업"));
          const extra = random() < 0.35 ? 2 : random() < 0.7 ? 1 : 0;
          for (let e = 0; e < extra; e++) {
            const from = 9 * 60 + Math.floor(random() * 15) * 30;
            const length = [30, 60, 60, 90, 120][Math.floor(random() * 5)];
            if (from + length <= 18 * 60) blocks.push(block(date, from, from + length, MEETING_TITLES[Math.floor(random() * MEETING_TITLES.length)]));
          }
        }
        const name = names[n];
        const id = `p${String(n + 1).padStart(3, "0")}`;
        people.push({
          id, name, email: `${id}@nodi.demo`, title, team, department, timezone: "Asia/Seoul",
          calendarStatus: random() < 0.05 ? "unavailable" : "connected",
          recentMeetingAt: random() < 0.04 ? `${addDays(baseDate, -1 - Math.floor(random() * 14))}T10:00:00+09:00` : undefined,
          workHours: { start: random() < 0.15 ? 10 : 9, end: random() < 0.15 ? 17 : 18 },
          leave: leave.length ? leave : undefined,
          blocks,
        });
      }
    }
  }
  return people;
}

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
// ponytail: 기준일은 서버가 켜진 날이에요. 며칠씩 켜 두는 서비스라면 날짜가 지나도록 다시 만들어야 해요.
export const orgPeople: DemoPerson[] = [
  ...demoPeople.map((person) => ({ ...person, department: person.team ? SAMPLE_DEPARTMENT[person.team] : undefined })),
  ...generateOrg(today),
];
