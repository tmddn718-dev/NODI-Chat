import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AvailabilityResponse, AvailabilityStatus, InvitationRecord, MeetingDraft } from "./types.ts";

export class InvitationStore {
  private writeQueue = Promise.resolve();

  constructor(
    private readonly filePath = process.env.NODI_INVITATION_DATA_PATH ?? path.resolve("data/invitations.json"),
    private readonly ttlMs = 7 * 24 * 60 * 60 * 1000,
    private readonly now = () => new Date(),
  ) {}

  private async read(): Promise<InvitationRecord[]> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as InvitationRecord[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async write(records: InvitationRecord[]) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(records, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.filePath);
  }

  create(meeting: MeetingDraft, requestId: string): Promise<InvitationRecord> {
    let result: InvitationRecord;
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const records = await this.read();
      const existingIndex = records.findIndex((item) => item.requestId === requestId);
      const existing = existingIndex >= 0 ? records[existingIndex] : undefined;
      if (existing?.participantAccess?.length && Date.parse(existing.expiresAt) > this.now().getTime()) {
        result = existing;
        return;
      }
      if (existingIndex >= 0) records.splice(existingIndex, 1);
      const now = this.now();
      const attendees = [...new Set((meeting.attendees ?? []).map((attendee) => attendee.trim()).filter(Boolean))];
      result = {
        id: randomUUID(),
        token: randomBytes(24).toString("hex"),
        requestId,
        meeting,
        availability: attendees.map((attendee) => ({ attendee, status: "no_response" })),
        participantAccess: attendees.map((attendee) => ({ attendee, token: randomBytes(24).toString("hex") })),
        expiresAt: new Date(now.getTime() + this.ttlMs).toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      records.push(result);
      await this.write(records);
    });
    return this.writeQueue.then(() => result!);
  }

  async get(token: string) {
    const record = (await this.read()).find((item) => item.token === token);
    return record && Date.parse(record.expiresAt) > this.now().getTime() ? record : undefined;
  }

  async getByAccessToken(token: string) {
    const record = (await this.read()).find((item) => item.participantAccess?.some((access) => access.token === token));
    if (!record || Date.parse(record.expiresAt) <= this.now().getTime()) return undefined;
    const attendee = record.participantAccess.find((access) => access.token === token)!.attendee;
    return { record, attendee };
  }

  respond(accessToken: string, status: Exclude<AvailabilityStatus, "no_response">, start?: string, end?: string): Promise<InvitationRecord> {
    let result: InvitationRecord;
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const records = await this.read();
      const index = records.findIndex((item) => item.participantAccess?.some((access) => access.token === accessToken));
      if (index < 0) throw new Error("유효하지 않은 초대 링크입니다.");
      const record = records[index];
      if (Date.parse(record.expiresAt) <= this.now().getTime()) throw new Error("만료된 초대 링크입니다.");
      const attendee = record.participantAccess.find((access) => access.token === accessToken)!.attendee;
      const response: AvailabilityResponse = status === "available"
        ? { attendee, status, start, end }
        : { attendee, status };
      result = {
        ...record,
        availability: record.availability.map((item) => item.attendee === attendee ? response : item),
        updatedAt: this.now().toISOString(),
      };
      records[index] = result;
      await this.write(records);
    });
    return this.writeQueue.then(() => result!);
  }
}
