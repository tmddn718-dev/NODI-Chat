import type { DemoPerson, MeetingEvent } from "./types.ts";

export type PersonSummary = Pick<DemoPerson, "id" | "name" | "email" | "timezone" | "calendarStatus"> & {
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
      return { id: person.id, name: person.name, email: person.email, timezone: person.timezone, calendarStatus: person.calendarStatus, recent: Boolean(lastMetAt), lastMetAt };
    })
    .filter((person) => !target || normalize(person.name).includes(target) || normalize(person.email).includes(target))
    .sort((a, b) => Number(b.recent) - Number(a.recent) || (b.lastMetAt ?? "").localeCompare(a.lastMetAt ?? "") || a.name.localeCompare(b.name, "ko"));
}
