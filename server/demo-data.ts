import type { DemoPerson } from "./types.ts";

const block = (date: string, start: string, end: string, title: string) => ({
  start: `${date}T${start}:00+09:00`,
  end: `${date}T${end}:00+09:00`,
  title,
});

export const demoPeople: DemoPerson[] = [
  {
    id: "minji",
    title: "프로덕트 매니저",
    team: "프로덕트팀",
    name: "김민지",
    email: "minji@nodi.demo",
    timezone: "Asia/Seoul",
    calendarStatus: "connected",
    recentMeetingAt: "2026-10-24T10:00:00+09:00",
    blocks: [
      block("2026-10-28", "10:00", "11:00", "제품 스탠드업"),
      block("2026-10-28", "14:00", "15:30", "고객 인터뷰"),
      block("2026-10-29", "11:00", "12:00", "리서치 공유"),
      block("2026-10-30", "15:00", "16:00", "1:1"),
    ],
  },
  {
    id: "junho",
    title: "프론트엔드 리드",
    team: "개발팀",
    name: "박준호",
    email: "junho@nodi.demo",
    timezone: "Asia/Seoul",
    calendarStatus: "connected",
    recentMeetingAt: "2026-10-22T14:30:00+09:00",
    blocks: [
      block("2026-10-28", "09:00", "10:30", "개발 주간 회의"),
      block("2026-10-28", "13:00", "14:00", "코드 리뷰"),
      block("2026-10-29", "14:00", "16:00", "집중 업무"),
      block("2026-10-30", "10:00", "11:30", "아키텍처 리뷰"),
    ],
  },
  {
    id: "sora",
    title: "시니어 디자이너",
    team: "디자인팀",
    name: "이소라",
    email: "sora@nodi.demo",
    timezone: "Asia/Seoul",
    calendarStatus: "connected",
    recentMeetingAt: "2026-10-18T11:00:00+09:00",
    blocks: [
      block("2026-10-28", "11:00", "12:30", "디자인 리뷰"),
      block("2026-10-29", "09:30", "11:00", "브랜드 워크숍"),
      block("2026-10-30", "13:00", "14:30", "디자인 시스템"),
    ],
  },
  {
    id: "alex",
    title: "마케팅 매니저",
    team: "마케팅팀",
    name: "Alex Morgan",
    email: "alex@nodi.demo",
    timezone: "America/Los_Angeles",
    calendarStatus: "connected",
    blocks: [
      block("2026-10-28", "16:00", "17:30", "Partner sync"),
      block("2026-10-29", "16:30", "18:00", "Roadmap review"),
    ],
  },
  {
    id: "yujin",
    title: "백엔드 엔지니어",
    team: "개발팀",
    name: "최유진",
    email: "yujin@nodi.demo",
    timezone: "Asia/Seoul",
    calendarStatus: "unavailable",
    blocks: [],
  },
];

// 체험 모드는 오래 열려 있어도 충돌 일정이 보이도록, 샘플 일정을 앞으로 올 두 주에 걸쳐 같은 요일로 옮겨요.
if (process.env.NODI_MODE === "demo" || process.env.NODI_MODE === "public") {
  const base = Date.parse("2026-10-28T00:00:00Z");
  const today = Date.parse(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date())}T00:00:00Z`);
  const weeks = Math.max(0, Math.ceil((today - base) / (7 * 86_400_000)));
  const move = (iso: string, w: number) => new Date(Date.parse(iso.slice(0, 10) + "T00:00:00Z") + w * 7 * 86_400_000).toISOString().slice(0, 10) + iso.slice(10);
  for (const person of demoPeople) {
    const original = person.blocks;
    person.blocks = [weeks, weeks + 1].flatMap((w) => original.map((item) => ({ ...item, start: move(item.start, w), end: move(item.end, w) })));
  }
}
