import type { DemoPerson, MeetingEvent } from "./types.ts";

export type PersonSummary = Pick<DemoPerson, "id" | "name" | "email" | "timezone" | "calendarStatus" | "title" | "team" | "department"> & {
  recent: boolean;
  lastMetAt?: string;
};

const normalize = (value: string) => value.trim().toLocaleLowerCase("ko-KR").replaceAll(" ", "");

export function searchPeople(people: DemoPerson[], events: MeetingEvent[], query = ""): PersonSummary[] {
  const recentByName = new Map<string, string>();
  for (const event of events) {
    for (const attendee of event.meeting.attendees ?? []) {
      const key = normalize(attendee);
      const previous = recentByName.get(key);
      if (!previous || event.candidate.start > previous) recentByName.set(key, event.candidate.start);
    }
  }
  const target = normalize(query);
  return people
    .map((person) => {
      const lastMetAt = recentByName.get(normalize(person.name)) ?? person.recentMeetingAt;
      return { id: person.id, name: person.name, email: person.email, timezone: person.timezone, calendarStatus: person.calendarStatus, recent: Boolean(lastMetAt), lastMetAt, title: person.title, team: person.team, department: person.department };
    })
    .filter((person) => !target || normalize(person.name).includes(target) || normalize(person.email).includes(target))
    .sort((a, b) => Number(b.recent) - Number(a.recent) || (b.lastMetAt ?? "").localeCompare(a.lastMetAt ?? "") || a.name.localeCompare(b.name, "ko"));
}

export type DirectoryQuery = { query?: string; department?: string; team?: string; limit?: number; offset?: number };

// 구성원이 많아도 한 번에 일부만 내려주는 검색. 이름·이메일·팀·부서·직무에서 찾고, 이름이 먼저 맞는 사람을 앞에 둬요.
// 일정 블록(제목 포함)은 결과에 담지 않아요. 가능 여부 계산에만 서버 안에서 써요.
export function searchDirectory(people: DemoPerson[], events: MeetingEvent[], { query = "", department, team, limit = 30, offset = 0 }: DirectoryQuery = {}) {
  const target = normalize(query);
  const scoped = people.filter((person) => (!department || person.department === department) && (!team || person.team === team));
  const matches = target ? scoped.filter((person) => [person.name, person.email, person.team, person.department, person.title].some((value) => value && normalize(value).includes(target))) : scoped;
  const ranked = searchPeople(matches, events);
  if (target) ranked.sort((a, b) => Number(normalize(b.name).startsWith(target)) - Number(normalize(a.name).startsWith(target)));
  const size = Math.max(1, Math.min(500, Math.floor(limit)));
  const from = Math.max(0, Math.floor(offset));
  return { people: ranked.slice(from, from + size), total: ranked.length, hasMore: from + size < ranked.length };
}

export function orgTree(people: DemoPerson[]) {
  const departments = new Map<string, Map<string, number>>();
  for (const person of people) {
    const teams = departments.get(person.department ?? "기타") ?? new Map<string, number>();
    teams.set(person.team ?? "기타", (teams.get(person.team ?? "기타") ?? 0) + 1);
    departments.set(person.department ?? "기타", teams);
  }
  return {
    total: people.length,
    departments: [...departments.entries()].sort(([a], [b]) => a.localeCompare(b, "ko")).map(([name, teams]) => ({
      name,
      count: [...teams.values()].reduce((sum, value) => sum + value, 0),
      teams: [...teams.entries()].sort(([a], [b]) => a.localeCompare(b, "ko")).map(([team, count]) => ({ name: team, count })),
    })),
  };
}
