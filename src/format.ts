const md = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
const wd = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "short" });
const tm = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" });

// 추천 시간 표기: "10월 30일(금) 오전 9:00"
export const slotLabel = (iso: string) => `${md.format(new Date(iso))}(${wd.format(new Date(iso))}) ${tm.format(new Date(iso))}`;
export const clockLabel = (iso: string) => tm.format(new Date(iso));
export const minutesBetween = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
