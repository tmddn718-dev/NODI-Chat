import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { DraftPayload, DraftRecord } from "./types.ts";

export class DraftConflictError extends Error {}

export class DraftStore {
  private writeQueue = Promise.resolve();

  constructor(private readonly filePath = process.env.NODI_DRAFT_DATA_PATH ?? path.resolve("data/drafts.json")) {}

  private async read(): Promise<DraftRecord[]> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as DraftRecord[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async write(records: DraftRecord[]) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(records, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.filePath);
  }

  async get(workspaceId: string) {
    return (await this.read()).find((record) => record.workspaceId === workspaceId);
  }

  save(workspaceId: string, expectedVersion: number, payload: DraftPayload): Promise<DraftRecord> {
    let result: DraftRecord;
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const records = await this.read();
      const index = records.findIndex((record) => record.workspaceId === workspaceId);
      const current = index >= 0 ? records[index] : undefined;
      if ((current?.version ?? 0) !== expectedVersion) throw new DraftConflictError("다른 기기에서 회의 초안이 변경됐어요.");
      const now = new Date().toISOString();
      result = {
        workspaceId,
        version: expectedVersion + 1,
        payload,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
      };
      if (index >= 0) records[index] = result;
      else records.push(result);
      await this.write(records);
    });
    return this.writeQueue.then(() => result!);
  }

  delete(workspaceId: string): Promise<void> {
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const records = await this.read();
      await this.write(records.filter((record) => record.workspaceId !== workspaceId));
    });
    return this.writeQueue;
  }
}
