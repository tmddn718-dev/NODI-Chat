import { demoPeople } from "./demo-data.ts";
import type { Candidate, DemoPerson, MeetingDraft } from "./types.ts";

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function findPerson(value: string, people: DemoPerson[]) {
  const target = normalize(value);
  return people.find((person) =>
    [person.id, person.name, person.email, person.email.split("@")[0]].some((candidate) => {
      const normalized = normalize(candidate);
      return normalized === target || (target.length >= 2 && normalized.endsWith(target));
    }),
  );
}

function overlaps(start: Date, end: Date, blockStart: string, blockEnd: string) {
  return start < new Date(blockEnd) && end > new Date(blockStart);
}

function kstDateAt(date: string, hours: number, minutes: number) {
  return new Date(`${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00+09:00`);
}

function dateRange(start: string, end: string) {
  const result: string[] = [];
  const startUtc = Date.parse(`${start}T00:00:00+09:00`);
  const endUtc = Date.parse(`${end}T00:00:00+09:00`);
  if (!Number.isFinite(startUtc) || !Number.isFinite(endUtc) || startUtc > endUtc) return result;
  for (let time = startUtc; time <= endUtc && result.length < 31; time += DAY_MS) {
    result.push(new Date(time + KST_OFFSET_MS).toISOString().slice(0, 10));
  }
  return result;
}

export function validateMeeting(meeting: MeetingDraft) {
  const missing: string[] = [];
  if (!meeting.title?.trim()) missing.push("회의 제목");
  if (!meeting.durationMinutes || meeting.durationMinutes < 15) missing.push("소요 시간");
  if (!meeting.attendees?.length) missing.push("참석자");
  if (!meeting.dateStart || !meeting.dateEnd) missing.push("날짜 범위");
  return missing;
}

export function recommendSlots(meeting: MeetingDraft, people = demoPeople): Candidate[] {
  const missing = validateMeeting(meeting);
  if (missing.length) throw new Error(`필수 정보가 필요합니다: ${missing.join(", ")}`);

  const uniqueAttendees = [...new Set(meeting.attendees!.map((value) => value.trim()).filter(Boolean))];
  const required = new Set((meeting.requiredAttendees ?? []).map(normalize));
  const duration = meeting.durationMinutes!;
  const slots: Candidate[] = [];

  for (const date of dateRange(meeting.dateStart!, meeting.dateEnd!)) {
    const day = kstDateAt(date, 12, 0).getUTCDay();
    if (day === 0 || day === 6) continue;

    for (let minutes = 9 * 60; minutes + duration <= 18 * 60; minutes += 30) {
      const start = kstDateAt(date, Math.floor(minutes / 60), minutes % 60);
      const end = new Date(start.getTime() + duration * 60_000);
      const unavailable: string[] = [];
      const unknown: string[] = [];
      let available = 0;
      let requiredAvailable = true;

      for (const attendee of uniqueAttendees) {
        const person = findPerson(attendee, people);
        const isRequired = required.has(normalize(attendee));
        if (!person || person.calendarStatus !== "connected") {
          unknown.push(attendee);
          if (isRequired) requiredAvailable = false;
          continue;
        }
        const busy = person.blocks.some((item) => overlaps(start, end, item.start, item.end));
        if (busy) {
          unavailable.push(person.name);
          if (isRequired || required.has(normalize(person.name)) || required.has(normalize(person.email))) {
            requiredAvailable = false;
          }
        } else {
          available += 1;
        }
      }

      const hour = Number(
        new Intl.DateTimeFormat("en-US", { hour: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(start),
      );
      const preferred =
        meeting.preferredTime === "any" || !meeting.preferredTime ||
        (meeting.preferredTime === "morning" && hour < 12) ||
        (meeting.preferredTime === "afternoon" && hour >= 13);
      const allKnown = unknown.length === 0;
      const attendanceRatio = available / uniqueAttendees.length;
      const score = Math.max(
        0,
        Math.round(attendanceRatio * 65 + (requiredAvailable ? 20 : 0) + (preferred ? 10 : 0) + (allKnown ? 5 : 0)),
      );
      const reasonParts = [
        requiredAvailable ? "필수 참석자 일정 확인" : "필수 참석자 확인 필요",
        preferred ? "선호 시간대 반영" : "선호 시간대 외",
      ];
      if (unknown.length) reasonParts.push(`${unknown.length}명 일정 미확인`);

      slots.push({
        id: `${date}-${minutes}`,
        start: start.toISOString(),
        end: end.toISOString(),
        available,
        total: uniqueAttendees.length,
        requiredAvailable,
        score,
        reason: reasonParts.join(", "),
        unavailable,
        unknown,
      });
    }
  }

  return slots
    .sort((a, b) => b.score - a.score || a.start.localeCompare(b.start))
    .slice(0, 3);
}
