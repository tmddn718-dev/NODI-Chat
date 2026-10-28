import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dispatch, OutboxMailer } from "./mailer.ts";
import { RoundStaleError, RoundStore, requiredFirstCandidates, summarize } from "./round.ts";

const meeting = {
  title: "킥오프", purpose: "시작", durationMinutes: 60, version: 1,
  attendees: ["김민지", "박준호", "이소라", "Alex Morgan"],
  requiredAttendees: ["김민지", "박준호"],
  dateStart: "2026-11-02", dateEnd: "2026-11-06", preferredTime: "any" as const,
};

describe("candidate round", () => {
  it("ranks by optional responses, keeps unanswered as unknown, and rejects stale versions", async () => {
    const store = new RoundStore(path.join(await mkdtemp(path.join(tmpdir(), "nodi-round-")), "rounds.json"));
    const candidates = requiredFirstCandidates(meeting);
    expect(candidates).toHaveLength(3);
    expect(candidates.every((c) => c.requiredAvailable)).toBe(true);
    const lateOnly = requiredFirstCandidates(meeting, Date.parse(candidates[0].start) + 1);
    expect(lateOnly.every((c) => Date.parse(c.start) > Date.parse(candidates[0].start))).toBe(true);
    const round = await store.create(meeting, candidates, "2026-11-01T00:00:00.000Z", "r1");
    expect((await store.create(meeting, candidates, "2026-11-01T00:00:00.000Z", "r1")).token).toBe(round.token);

    const [sora, alex] = round.participants;
    const [a, b] = candidates;
    await store.respond(sora.token, 1, { [a.id]: "declined", [b.id]: "accepted" });
    const after = await store.respond(alex.token, 1, { [b.id]: "tentative" });
    const summary = summarize(after, new Date("2026-10-30T00:00:00Z"));
    expect(summary.rows[0].candidate.id).toBe(b.id);
    expect(summary.rows[0]).toMatchObject({ accepted: 1, tentative: 1, noResponse: 0 });
    expect(summary.phase).toBe("final"); // 전원 응답
    expect(summarize({ ...after, participants: [sora, { ...alex, respondedAt: undefined }] } as typeof after, new Date("2026-10-30T00:00:00Z")).phase).toBe("collecting");
    expect(summarize(after, new Date("2026-11-02T00:00:00Z")).pastDeadline).toBe(true);

    await store.refresh(round.token, candidates.slice(0, 1));
    await expect(store.respond(sora.token, 1, {})).rejects.toBeInstanceOf(RoundStaleError);
    await store.remind(round.token);
    await expect(store.remind(round.token)).rejects.toThrow("한 번만");

    expect((await store.markConfirmed(round.token, { start: "2026-10-29T00:00:00.000Z", end: "2026-10-29T01:00:00.000Z" })).confirmed?.start).toBe("2026-10-29T00:00:00.000Z");
    await expect(store.markConfirmed(round.token, { start: "x", end: "y" }).then((r) => r.confirmed?.start)).resolves.toBe("2026-10-29T00:00:00.000Z"); // 처음 값 유지
    await expect(store.respond(sora.token, 2, {})).rejects.toThrow("확정");
    const later = new Date(Date.parse(round.deadlineAt) + 3_600_000).toISOString();
    expect((await store.extend(round.token, later)).deadlineAt).toBe(later);
    await expect(store.extend(round.token, round.deadlineAt)).rejects.toThrow("뒤의 시간");
  });
});

describe("invitation dispatch", () => {
  it("sends once, reports unreachable attendees as failed, and reminds only unanswered recipients", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "nodi-mail-"));
    const store = new RoundStore(path.join(dir, "rounds.json"));
    const mailer = new OutboxMailer(path.join(dir, "outbox.json"));
    const withStranger = { ...meeting, attendees: [...meeting.attendees, "모르는사람"] };
    const round = await store.create(withStranger, requiredFirstCandidates(withStranger), "2099-01-01T00:00:00.000Z", "m1");
    const sent = await dispatch(store, mailer, round, "invite", "http://x.test");
    const by = (name: string) => sent.participants.find((p) => p.attendee === name)!;
    expect(by("이소라").delivery).toBe("sent");
    expect(by("모르는사람")).toMatchObject({ delivery: "failed", deliveryError: expect.any(String) });
    await dispatch(store, mailer, sent, "invite", "http://x.test"); // 재시도해도 중복 기록 없음
    await store.respond(by("이소라").token, 1, { [sent.candidates[0].id]: "accepted" });
    const reminded = await dispatch(store, mailer, (await store.get(round.token))!, "reminder", "http://x.test");
    const box = JSON.parse(await readFile(path.join(dir, "outbox.json"), "utf8")) as Array<{ id: string; to: string }>;
    expect(box.filter((m) => m.id.endsWith(":invite")).map((m) => m.to).sort()).toEqual(["alex@nodi.demo", "sora@nodi.demo"]);
    expect(box.filter((m) => m.id.endsWith(":reminder")).map((m) => m.to)).toEqual(["alex@nodi.demo"]);
    expect(reminded.participants).toHaveLength(3);
  });
});
