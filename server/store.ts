import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { MeetingEvent } from "./types.ts";

type StoredEvent = MeetingEvent & { requestId: string };

function withoutRequestId({ requestId: _requestId, ...event }: StoredEvent): MeetingEvent {
  return event;
}

export interface MeetingStore {
  list(): Promise<MeetingEvent[]>;
  findByRequestId(requestId: string): Promise<MeetingEvent | undefined>;
  create(event: MeetingEvent, requestId: string): Promise<MeetingEvent>;
  save(event: MeetingEvent, requestId: string): Promise<MeetingEvent>;
  get(id: string): Promise<StoredEvent | undefined>;
}

// 체험(데모) 모드용: 방문자별로 따로 두고 디스크에 쓰지 않는다. 서버가 꺼지면 사라진다.
export class MemoryMeetingStore implements MeetingStore {
  private events: StoredEvent[] = [];
  async list() { return this.events.map(withoutRequestId); }
  async findByRequestId(requestId: string) {
    const event = this.events.find((item) => item.requestId === requestId);
    return event ? withoutRequestId(event) : undefined;
  }
  async create(event: MeetingEvent, requestId: string) {
    const existing = this.events.find((item) => item.requestId === requestId);
    if (existing) return withoutRequestId(existing);
    this.events.push({ ...event, requestId });
    return event;
  }
  async save(event: MeetingEvent, requestId: string) {
    const index = this.events.findIndex((item) => item.id === event.id);
    const stored = { ...event, requestId };
    if (index >= 0) this.events[index] = stored; else this.events.push(stored);
    return event;
  }
  async get(id: string) { return this.events.find((event) => event.id === id); }
}

export class FileMeetingStore implements MeetingStore {
  private writeQueue = Promise.resolve();

  constructor(private readonly filePath = process.env.NODI_DATA_PATH ?? path.resolve("data/meetings.json")) {}

  private async read(): Promise<StoredEvent[]> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as StoredEvent[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async write(events: StoredEvent[]) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporary = `${this.filePath}.tmp`;
    await writeFile(temporary, JSON.stringify(events, null, 2), { encoding: "utf8", mode: 0o600 });
    await rename(temporary, this.filePath);
  }

  async list() {
    return (await this.read()).map(withoutRequestId);
  }

  async findByRequestId(requestId: string) {
    const event = (await this.read()).find((item) => item.requestId === requestId);
    return event ? withoutRequestId(event) : undefined;
  }

  create(event: MeetingEvent, requestId: string): Promise<MeetingEvent> {
    let result = event;
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const events = await this.read();
      const existing = events.find((item) => item.requestId === requestId);
      if (existing) {
        result = withoutRequestId(existing);
        return;
      }
      events.push({ ...event, requestId });
      await this.write(events);
    });
    return this.writeQueue.then(() => result);
  }

  save(event: MeetingEvent, requestId: string) {
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const events = await this.read();
      const index = events.findIndex((item) => item.id === event.id);
      const stored = { ...event, requestId };
      if (index >= 0) events[index] = stored;
      else events.push(stored);
      await this.write(events);
    });
    return this.writeQueue.then(() => event);
  }

  async get(id: string) {
    return (await this.read()).find((event) => event.id === id);
  }
}
