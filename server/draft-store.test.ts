import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DraftConflictError, DraftStore } from "./draft-store.ts";

const payload = {
  meeting: { title: "킥오프", version: 1 },
  availability: [],
  messages: [{ id: "intro", role: "assistant" as const, content: "어떤 회의인가요?" }],
};

describe("DraftStore", () => {
  it("persists and versions one draft per workspace", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nodi-draft-"));
    const store = new DraftStore(path.join(directory, "drafts.json"));
    const first = await store.save("workspace-1", 0, payload);
    const second = await store.save("workspace-1", 1, { ...payload, input: "작성 중" });
    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect((await store.get("workspace-1"))?.payload.input).toBe("작성 중");
  });

  it("blocks a stale device write instead of overwriting newer work", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nodi-draft-"));
    const store = new DraftStore(path.join(directory, "drafts.json"));
    await store.save("workspace-1", 0, payload);
    await expect(store.save("workspace-1", 0, payload)).rejects.toBeInstanceOf(DraftConflictError);
  });
});
