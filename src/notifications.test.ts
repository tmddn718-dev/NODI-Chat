import { describe, expect, it } from "vitest";
import { buildInvitedMeetings } from "./invited";
import { buildNotifications } from "./notifications";

const NOW = Date.parse("2026-11-09T01:00:00.000Z");
const none = { loaded: false, invited: false, pending: 0, total: 0 };

describe("buildNotifications", () => {
  it("lists unanswered invites and confirmed meetings from real invited data", () => {
    const meetings = buildInvitedMeetings(NOW);
    const items = buildNotifications(meetings, {}, none, NOW);
    expect(items.filter((item) => item.kind === "invite").length).toBe(2);
    expect(items.filter((item) => item.kind === "confirmed").length).toBe(1);
    expect(items[0].title).toContain("초대했어요");
  });
  it("drops an invite once answered and reports waiting responses honestly", () => {
    const meetings = buildInvitedMeetings(NOW);
    const answers = { "inv-roadmap": { mode: "pick" as const, picks: ["a"], answeredAt: "x" } };
    const items = buildNotifications(meetings, answers, { loaded: true, invited: true, pending: 2, total: 3 }, NOW);
    expect(items.some((item) => item.id === "invite:inv-roadmap")).toBe(false);
    expect(items.find((item) => item.kind === "round")?.body).toBe("2명이 아직 응답하지 않았어요");
    expect(buildNotifications(meetings, {}, { loaded: true, invited: false, pending: 0, total: 3 }, NOW).some((item) => item.kind === "round")).toBe(false);
  });
});
