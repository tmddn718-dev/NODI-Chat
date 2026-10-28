// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ roundInvitation: vi.fn(), respondToRound: vi.fn() }));
vi.mock("../api", () => ({
  ApiError: class ApiError extends Error { constructor(message: string, readonly status: number, readonly code?: string) { super(message); } },
  api: { roundInvitation: mocks.roundInvitation, respondToRound: mocks.respondToRound },
}));
import { CandidateInviteScreen } from "./CandidateInviteScreen";

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const base = { meeting: { title: "킥오프", purpose: "공유", durationMinutes: 60 }, attendee: "이소라", candidates: [{ id: "a", start: "2026-10-30T01:00:00Z", end: "2026-10-30T02:00:00Z" }], responses: {}, version: 1, deadlineAt: "2026-10-29T00:00:00Z", pastDeadline: false };

describe("CandidateInviteScreen in operation", () => {
  it("shows the confirmed time read-only once the organizer confirmed", async () => {
    mocks.roundInvitation.mockResolvedValue({ invitation: { ...base, confirmed: { start: "2026-10-30T01:00:00Z", end: "2026-10-30T02:00:00Z" } } });
    render(<CandidateInviteScreen token={"a".repeat(48)} />);
    await waitFor(() => expect(screen.getByText("회의가 확정됐어요")).toBeTruthy());
    expect(screen.queryByRole("button", { name: /응답 제출/ })).toBeNull();
    expect(screen.getByText(/더 이상 답변을 바꿀 수 없어요/)).toBeTruthy();
  });

  it("explains what to do when the link cannot be opened", async () => {
    mocks.roundInvitation.mockRejectedValue(new Error("유효하지 않거나 만료된 초대 링크입니다."));
    render(<CandidateInviteScreen token={"b".repeat(48)} />);
    await waitFor(() => expect(screen.getByText("초대장을 열 수 없어요")).toBeTruthy());
    expect(screen.getByText(/주최자에게 새 링크를 요청해 주세요/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "다시 불러오기" })).toBeTruthy();
  });
});
