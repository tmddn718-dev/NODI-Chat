import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { InvitationStore } from "./invitation-store.ts";

describe("InvitationStore", () => {
  it("creates one unguessable invitation per request and saves attendee responses", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nodi-invite-"));
    const store = new InvitationStore(path.join(directory, "invitations.json"));
    const meeting = { title: "킥오프", attendees: ["김민지", "박준호"], version: 2 };
    const first = await store.create(meeting, "request-1");
    const duplicate = await store.create(meeting, "request-1");
    expect(duplicate.token).toBe(first.token);
    expect(first.token).toHaveLength(48);
    expect(first.participantAccess).toHaveLength(2);
    expect(first.participantAccess[0].token).not.toBe(first.participantAccess[1].token);
    const accessToken = first.participantAccess.find((item) => item.attendee === "김민지")!.token;
    const updated = await store.respond(accessToken, "available", "2026-10-28T09:00:00+09:00", "2026-10-28T12:00:00+09:00");
    expect(updated.availability[0]).toMatchObject({ attendee: "김민지", status: "available" });
    expect(updated.availability[1].status).toBe("no_response");
  });

  it("rejects an organizer or unknown token and accepts only the assigned participant token", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nodi-invite-"));
    const store = new InvitationStore(path.join(directory, "invitations.json"));
    const invitation = await store.create({ title: "리뷰", attendees: ["이소라"] }, "request-2");
    await expect(store.respond(invitation.token, "tentative")).rejects.toThrow("유효하지 않은");
    await expect(store.respond("a".repeat(48), "tentative")).rejects.toThrow("유효하지 않은");
    await expect(store.respond(invitation.participantAccess[0].token, "tentative")).resolves.toMatchObject({
      availability: [{ attendee: "이소라", status: "tentative" }],
    });
  });

  it("expires participant access", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "nodi-invite-"));
    let current = new Date("2026-10-27T00:00:00.000Z");
    const store = new InvitationStore(path.join(directory, "invitations.json"), 1000, () => current);
    const invitation = await store.create({ title: "리뷰", attendees: ["이소라"] }, "request-3");
    current = new Date("2026-10-27T00:00:02.000Z");
    expect(await store.getByAccessToken(invitation.participantAccess[0].token)).toBeUndefined();
    await expect(store.respond(invitation.participantAccess[0].token, "tentative")).rejects.toThrow("만료된");
    const renewed = await store.create({ title: "리뷰", attendees: ["이소라"] }, "request-3");
    expect(renewed.token).not.toBe(invitation.token);
  });
});
