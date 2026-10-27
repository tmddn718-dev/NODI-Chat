import type { DemoPerson } from "./types.ts";

const block = (date: string, start: string, end: string, title: string) => ({
  start: `${date}T${start}:00+09:00`,
  end: `${date}T${end}:00+09:00`,
  title,
});

export const demoPeople: DemoPerson[] = [
  {
    id: "minji",
    name: "김민지",
    email: "minji@nodi.demo",
    timezone: "Asia/Seoul",
    calendarStatus: "connected",
    blocks: [
      block("2026-10-28", "10:00", "11:00", "제품 스탠드업"),
      block("2026-10-28", "14:00", "15:30", "고객 인터뷰"),
      block("2026-10-29", "11:00", "12:00", "리서치 공유"),
      block("2026-10-30", "15:00", "16:00", "1:1"),
    ],
  },
  {
    id: "junho",
    name: "박준호",
    email: "junho@nodi.demo",
    timezone: "Asia/Seoul",
    calendarStatus: "connected",
    blocks: [
      block("2026-10-28", "09:00", "10:30", "개발 주간 회의"),
      block("2026-10-28", "13:00", "14:00", "코드 리뷰"),
      block("2026-10-29", "14:00", "16:00", "집중 업무"),
      block("2026-10-30", "10:00", "11:30", "아키텍처 리뷰"),
    ],
  },
  {
    id: "sora",
    name: "이소라",
    email: "sora@nodi.demo",
    timezone: "Asia/Seoul",
    calendarStatus: "connected",
    blocks: [
      block("2026-10-28", "11:00", "12:30", "디자인 리뷰"),
      block("2026-10-29", "09:30", "11:00", "브랜드 워크숍"),
      block("2026-10-30", "13:00", "14:30", "디자인 시스템"),
    ],
  },
  {
    id: "alex",
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
    name: "최유진",
    email: "yujin@nodi.demo",
    timezone: "Asia/Seoul",
    calendarStatus: "unavailable",
    blocks: [],
  },
];
