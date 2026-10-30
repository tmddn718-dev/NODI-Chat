import { createHash } from "node:crypto";
import { orgPeople } from "./org-data.ts";
import type { AvailabilityResponse, Candidate, DemoPerson, MeetingDraft } from "./types.ts";

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

// 구성원이 수백 명이어도 후보 시간마다 처음부터 찾지 않도록, 이름 조회 결과와 일정 블록(밀리초)을 한 번만 계산해 둬요.
const lookupCache = new WeakMap<DemoPerson[], Map<string, DemoPerson | undefined>>();
function findPerson(value: string, people: DemoPerson[]) {
  const target = normalize(value);
  let cache = lookupCache.get(people);
  if (!cache) lookupCache.set(people, (cache = new Map()));
  if (cache.has(target)) return cache.get(target);
  const found = people.find((person) =>
    [person.id, person.name, person.email, person.email.split("@")[0]].some((candidate) => {
      const normalized = normalize(candidate);
      return normalized === target || (target.length >= 2 && normalized.endsWith(target));
    }),
  );
  cache.set(target, found);
  return found;
}

const blockCache = new WeakMap<DemoPerson, Array<[number, number]>>();
function busyBetween(person: DemoPerson, start: number, end: number) {
  let blocks = blockCache.get(person);
  if (!blocks) blockCache.set(person, (blocks = person.blocks.map((item): [number, number] => [Date.parse(item.start), Date.parse(item.end)])));
  return blocks.some(([from, to]) => start < to && end > from);
}

// 휴가이거나 근무 시간 밖이면 일정이 비어 보여도 참석할 수 없다고 봐요.
function awayAt(person: DemoPerson, date: string, startMinutes: number, duration: number) {
  if (person.leave?.includes(date)) return true;
  const hours = person.workHours;
  return Boolean(hours) && (startMinutes < hours!.start * 60 || startMinutes + duration > hours!.end * 60);
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
  if (!meeting.purpose?.trim()) missing.push("회의 목적");
  if (!meeting.durationMinutes || meeting.durationMinutes < 15 || meeting.durationMinutes > 480) missing.push("소요 시간");
  if (!meeting.attendees?.length) missing.push("참석자");
  if (meeting.requiredAttendees === undefined) missing.push("일정 확정 조건");
  if (!meeting.preferredTime) missing.push("선호 시간대");
  if (!meeting.dateStart || !meeting.dateEnd || meeting.dateStart > meeting.dateEnd) missing.push("날짜 범위");
  return missing;
}

export function recommendSlots(meeting: MeetingDraft, people = orgPeople, responses?: AvailabilityResponse[], spread = false, notBefore = 0): Candidate[] {
  const missing = validateMeeting(meeting);
  if (missing.length) throw new Error(`필수 정보가 필요합니다: ${missing.join(", ")}`);

  const uniqueAttendees = [...new Set(meeting.attendees!.map((value) => value.trim()).filter(Boolean))];
  const required = new Set((meeting.requiredAttendees ?? []).map(normalize));
  const responseByAttendee = new Map((responses ?? []).map((response) => [normalize(response.attendee), response]));
  const duration = meeting.durationMinutes!;
  const basedOnMeetingVersion = meeting.version ?? 1;
  const basisKey = createHash("sha256")
    .update(JSON.stringify({ meeting, responses: responses ?? null }))
    .digest("hex")
    .slice(0, 20);
  const checkedAt = new Date().toISOString();
  const slots: Candidate[] = [];

  for (const date of dateRange(meeting.dateStart!, meeting.dateEnd!)) {
    const day = kstDateAt(date, 12, 0).getUTCDay();
    if (day === 0 || day === 6) continue;

    for (let minutes = 9 * 60; minutes + duration <= 18 * 60; minutes += 30) {
      const start = kstDateAt(date, Math.floor(minutes / 60), minutes % 60);
      if (start.getTime() < notBefore) continue;
      const end = new Date(start.getTime() + duration * 60_000);
      const unavailable: string[] = [];
      const unknown: string[] = [];
      const tentative: string[] = [];
      const noResponse: string[] = [];
      const evidence: NonNullable<Candidate["evidence"]> = [];
      let available = 0;
      let calendarFreeCount = 0;
      let manualAvailableCount = 0;
      let requiredAvailable = true;

      for (const attendee of uniqueAttendees) {
        const person = findPerson(attendee, people);
        const isRequired = required.has(normalize(attendee));
        const response = responseByAttendee.get(normalize(attendee));
        if (response && response.status !== "no_response") {
          if (response.status === "tentative") {
            unknown.push(attendee);
            tentative.push(attendee);
            evidence.push({ attendee, evidence: "tentative" });
            if (isRequired) requiredAvailable = false;
            continue;
          }
          const insideAvailableWindow = response.status === "available" && response.start && response.end &&
            start >= new Date(response.start) && end <= new Date(response.end);
          if (insideAvailableWindow) {
            available += 1;
            manualAvailableCount += 1;
            evidence.push({ attendee, evidence: "direct_available" });
          } else {
            unavailable.push(attendee);
            evidence.push({ attendee, evidence: "direct_unavailable" });
            if (isRequired) requiredAvailable = false;
          }
          continue;
        }
        if (!person || person.calendarStatus !== "connected") {
          unknown.push(attendee);
          noResponse.push(attendee);
          evidence.push({ attendee, evidence: person ? "calendar_unavailable" : "no_response" });
          if (isRequired) requiredAvailable = false;
          continue;
        }
        const away = awayAt(person, date, minutes, duration);
        const busy = away || busyBetween(person, start.getTime(), end.getTime());
        if (busy) {
          unavailable.push(person.name);
          evidence.push({ attendee, evidence: away ? "out_of_office" : "calendar_conflict" });
          if (isRequired || required.has(normalize(person.name)) || required.has(normalize(person.email))) {
            requiredAvailable = false;
          }
        } else {
          available += 1;
          calendarFreeCount += 1;
          evidence.push({ attendee, evidence: "calendar_free" });
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
        requiredAvailable ? "일정 확정 조건 충족" : "일정 확정 조건 확인 필요",
        preferred ? "선호 시간대 반영" : "선호 시간대 외",
      ];
      if (calendarFreeCount) reasonParts.push(`캘린더 빈 시간 ${calendarFreeCount}명`);
      if (manualAvailableCount) reasonParts.push(`직접 가능 응답 ${manualAvailableCount}명`);
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
        tentative,
        noResponse,
        calendarFreeCount,
        manualAvailableCount,
        conflictCount: unavailable.length,
        unknownCount: unknown.length,
        acceptedCount: 0,
        checkedAt,
        basedOnMeetingVersion,
        basisKey,
        evidence,
      });
    }
  }

  slots.sort((a, b) => Number(b.requiredAvailable) - Number(a.requiredAvailable) || b.score - a.score || a.start.localeCompare(b.start));
  if (!spread) return slots.slice(0, 3);
  // 참여하면 좋은 사람이 비교할 수 있도록 서로 3시간 이상 떨어진 후보만 고른다.
  const picked: Candidate[] = [];
  for (const slot of slots) {
    if (picked.every((item) => Math.abs(Date.parse(item.start) - Date.parse(slot.start)) >= 3 * 3_600_000)) picked.push(slot);
    if (picked.length === 3) break;
  }
  return picked;
}
