import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { recommendSlots } from "./recommendation.ts";
import type { Candidate, CandidateResponseStatus, MeetingDraft, RoundRecord } from "./types.ts";

const norm = (value: string) => value.trim().toLocaleLowerCase("ko-KR");
const EXTRA_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STATUSES: CandidateResponseStatus[] = ["accepted", "declined", "tentative"];

export class RoundStaleError extends Error {}
export class RoundClosedError extends Error {}

export function splitAttendees(meeting: MeetingDraft) {
  const required = new Set((meeting.requiredAttendees ?? []).map(norm));
  const all = [...new Set((meeting.attendees ?? []).map((name) => name.trim()).filter(Boolean))];
  return { required: all.filter((name) => required.has(norm(name))), optional: all.filter((name) => !required.has(norm(name))) };
}

// 필수 참석자 조건만으로 후보를 계산한다. 응답 마감(notBefore) 이후에 시작하는 시간만 후보로 삼는다. 참여하면 좋은 사람은 이후 후보별 응답으로 순위에만 반영한다.
export function requiredFirstCandidates(meeting: MeetingDraft, notBefore = 0): Candidate[] {
  const { required, optional } = splitAttendees(meeting);
  return recommendSlots({ ...meeting, attendees: required, requiredAttendees: required }, undefined, undefined, true, notBefore)
    .map((candidate) => ({ ...candidate, total: required.length + optional.length }));
}

export function summarize(record: RoundRecord, now = new Date()) {
  const rows = record.candidates.map((candidate) => {
    const counts = { accepted: 0, declined: 0, tentative: 0, noResponse: 0 };
    for (const participant of record.participants) {
      const status = participant.responses[candidate.id];
      if (status === "accepted") counts.accepted += 1;
      else if (status === "declined") counts.declined += 1;
      else if (status === "tentative") counts.tentative += 1;
      else counts.noResponse += 1;
    }
    return { candidate, ...counts };
  });
  const unknown = (row: (typeof rows)[number]) => row.tentative + row.noResponse;
  rows.sort((a, b) =>
    Number(b.candidate.requiredAvailable) - Number(a.candidate.requiredAvailable) ||
    b.accepted - a.accepted || a.declined - b.declined || unknown(a) - unknown(b) ||
    b.candidate.score - a.candidate.score || a.candidate.start.localeCompare(b.candidate.start));
  const ranked = rows.map((row, index) => {
    const previous = rows[index - 1];
    const tied = previous && previous.candidate.requiredAvailable === row.candidate.requiredAvailable &&
      previous.accepted === row.accepted && previous.declined === row.declined && unknown(previous) === unknown(row);
    const reason = [
      `참여하면 좋은 사람 중 가능 ${row.accepted}명`, `불가 ${row.declined}명`, `미정 ${row.tentative}명`, `미응답 ${row.noResponse}명`,
      tied ? "응답이 같아 선호 시간대·빠른 시간 순으로 정렬했어요" : "",
    ].filter(Boolean).join(" · ");
    return { ...row, rank: index + 1, reason };
  });
  const responded = record.participants.filter((participant) => participant.respondedAt).length;
  const deadlinePassed = now.getTime() >= Date.parse(record.deadlineAt);
  return {
    rows: ranked,
    responded,
    total: record.participants.length,
    phase: deadlinePassed || responded === record.participants.length ? "final" as const : "collecting" as const,
    pastDeadline: deadlinePassed,
  };
}

export class RoundStore {
  private writeQueue = Promise.resolve();

  constructor(
    private readonly filePath = process.env.NODI_ROUND_DATA_PATH ?? path.resolve("data/rounds.json"),
    private readonly now = () => new Date(),
  ) {}

  private async read(): Promise<RoundRecord[]> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as RoundRecord[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async write(records: RoundRecord[]) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(records, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.filePath);
  }

  private mutate<T>(change: (records: RoundRecord[]) => T): Promise<T> {
    let result: T;
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const records = await this.read();
      result = change(records);
      await this.write(records);
    });
    return this.writeQueue.then(() => result!);
  }

  private alive(record?: RoundRecord) {
    return record && Date.parse(record.expiresAt) > this.now().getTime() ? record : undefined;
  }

  create(meeting: MeetingDraft, candidates: Candidate[], deadlineAt: string, requestId: string) {
    return this.mutate((records) => {
      const existing = this.alive(records.find((item) => item.requestId === requestId));
      if (existing) return existing;
      const now = this.now();
      const record: RoundRecord = {
        id: randomUUID(),
        token: randomBytes(24).toString("hex"),
        requestId,
        meeting,
        candidates,
        version: 1,
        deadlineAt,
        reminderCount: 0,
        participants: splitAttendees(meeting).optional.map((attendee) => ({ attendee, token: randomBytes(24).toString("hex"), responses: {} })),
        expiresAt: new Date(Math.max(now.getTime(), Date.parse(deadlineAt)) + EXTRA_TTL_MS).toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      const stale = records.findIndex((item) => item.requestId === requestId);
      if (stale >= 0) records.splice(stale, 1);
      records.push(record);
      return record;
    });
  }

  async all() {
    return (await this.read()).filter((record) => this.alive(record));
  }

  recordDelivery(token: string, results: Array<{ attendee: string; ok: boolean; error?: string }>, baseUrl: string, firstInvite: boolean) {
    return this.mutate((records) => {
      const record = this.alive(records.find((item) => item.token === token));
      if (!record) throw new Error("조율을 찾을 수 없습니다.");
      const now = this.now().toISOString();
      for (const result of results) {
        const participant = record.participants.find((p) => p.attendee === result.attendee)!;
        participant.delivery = result.ok ? "sent" : "failed";
        participant.deliveryError = result.ok ? undefined : result.error;
        if (result.ok && firstInvite) participant.sentAt = now;
      }
      record.baseUrl = baseUrl;
      if (firstInvite && !record.invitedAt && results.some((r) => r.ok)) record.invitedAt = now;
      record.updatedAt = now;
      return record;
    });
  }

  async get(token: string) {
    return this.alive((await this.read()).find((item) => item.token === token));
  }

  async getByAccess(accessToken: string) {
    const record = this.alive((await this.read()).find((item) => item.participants.some((p) => p.token === accessToken)));
    return record && { record, participant: record.participants.find((p) => p.token === accessToken)! };
  }

  respond(accessToken: string, version: number, responses: Record<string, unknown>) {
    return this.mutate((records) => {
      const record = this.alive(records.find((item) => item.participants.some((p) => p.token === accessToken)));
      if (!record) throw new Error("유효하지 않거나 만료된 초대 링크입니다.");
      if (record.confirmed) throw new RoundClosedError("이미 회의 시간이 확정되어서 답변을 바꿀 수 없어요.");
      if (version !== record.version) throw new RoundStaleError("후보가 새로 바뀌었어요. 최신 초대장을 다시 열어 주세요.");
      const ids = new Set(record.candidates.map((candidate) => candidate.id));
      const clean: Record<string, CandidateResponseStatus> = {};
      for (const [id, status] of Object.entries(responses)) {
        if (!ids.has(id) || !STATUSES.includes(status as CandidateResponseStatus)) throw new Error("응답 정보를 확인해 주세요.");
        clean[id] = status as CandidateResponseStatus;
      }
      const participant = record.participants.find((p) => p.token === accessToken)!;
      participant.responses = clean;
      participant.respondedAt = Object.keys(clean).length ? this.now().toISOString() : undefined;
      record.updatedAt = this.now().toISOString();
      return record;
    });
  }

  // 후보 세트가 바뀌면 버전을 올리고, 같은 후보(id)의 응답만 유지한다.
  refresh(token: string, candidates: Candidate[]) {
    return this.mutate((records) => {
      const record = this.alive(records.find((item) => item.token === token));
      if (!record) throw new Error("조율을 찾을 수 없습니다.");
      const kept = new Set(candidates.filter((next) => record.candidates.some((old) => old.id === next.id && old.start === next.start)).map((c) => c.id));
      record.candidates = candidates;
      record.version += 1;
      for (const participant of record.participants) {
        participant.responses = Object.fromEntries(Object.entries(participant.responses).filter(([id]) => kept.has(id)));
        if (!Object.keys(participant.responses).length) participant.respondedAt = undefined;
      }
      record.updatedAt = this.now().toISOString();
      return record;
    });
  }

  // 확정되면 참석자가 링크를 다시 열었을 때 확정된 시간을 보여주고 더 이상 답변을 받지 않는다 (여러 번 호출해도 처음 값 유지).
  markConfirmed(token: string, slot: { start: string; end: string }) {
    return this.mutate((records) => {
      const record = this.alive(records.find((item) => item.token === token));
      if (!record) throw new Error("조율을 찾을 수 없습니다.");
      if (!record.confirmed) {
        record.confirmed = { ...slot, at: this.now().toISOString() };
        record.updatedAt = record.confirmed.at;
      }
      return record;
    });
  }

  // 응답 마감 연장: 현재 마감보다 늦은 시간으로만 바꿀 수 있고, 줄이거나 지난 시간으로는 바꾸지 않는다.
  extend(token: string, deadlineAt: string) {
    return this.mutate((records) => {
      const record = this.alive(records.find((item) => item.token === token));
      if (!record) throw new Error("조율을 찾을 수 없습니다.");
      const next = Date.parse(deadlineAt);
      if (!Number.isFinite(next) || next <= Math.max(this.now().getTime(), Date.parse(record.deadlineAt))) throw new Error("지금 마감보다 뒤의 시간을 골라 주세요.");
      record.deadlineAt = new Date(next).toISOString();
      record.expiresAt = new Date(next + EXTRA_TTL_MS).toISOString();
      record.updatedAt = this.now().toISOString();
      return record;
    });
  }

  remind(token: string) {
    return this.mutate((records) => {
      const record = this.alive(records.find((item) => item.token === token));
      if (!record) throw new Error("조율을 찾을 수 없습니다.");
      if (record.reminderCount >= 1) throw new Error("재알림은 한 번만 보낼 수 있어요.");
      if (this.now().getTime() >= Date.parse(record.deadlineAt)) throw new Error("마감 후에는 재알림을 보낼 수 없어요.");
      record.reminderCount += 1;
      record.updatedAt = this.now().toISOString();
      return record;
    });
  }
}
