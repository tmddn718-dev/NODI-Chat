// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Candidate } from "../types";
import { CandidateList } from "./CandidateList";
import { ConfirmDialog } from "./ConfirmDialog";

afterEach(cleanup);
const candidate: Candidate = {
  id: "c1", start: "2026-11-03T01:00:00.000Z", end: "2026-11-03T01:45:00.000Z", available: 3, total: 4, requiredAvailable: true, score: 82,
  reason: "x", unavailable: [], unknown: ["최유진"], tentative: [], noResponse: ["최유진"], calendarFreeCount: 2, manualAvailableCount: 1, conflictCount: 0, unknownCount: 1, acceptedCount: 0,
  checkedAt: "2026-10-29T01:00:00.000Z", basedOnMeetingVersion: 1, basisKey: "k",
  evidence: [{ attendee: "김민지", evidence: "calendar_free" }, { attendee: "박준호", evidence: "direct_available" }, { attendee: "이소라", evidence: "calendar_free" }, { attendee: "최유진", evidence: "no_response" }],
};

describe("CandidateList evidence", () => {
  it("leads with required-attendee status and sources, hides the score until details are opened", () => {
    render(<CandidateList candidates={[candidate]} requiredNames={["김민지", "박준호"]} onSelect={vi.fn()} />);
    expect(screen.getByText("가장 추천")).toBeTruthy();
    expect(screen.getByText("필수 참석자 2명 모두 가능")).toBeTruthy();
    expect(screen.getByText("전체 4명 중 3명 참석 가능")).toBeTruthy();
    expect(screen.getByText("캘린더 확인 2명 · 직접 응답 1명")).toBeTruthy();
    expect(screen.getByText("미응답 1명")).toBeTruthy();
    expect(screen.queryByText(/82점/)).toBeNull();
    const toggle = screen.getByRole("button", { name: /추천 근거 자세히 보기/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("직접 응답 · 가능")).toBeTruthy();
    expect(screen.getByText("응답 대기")).toBeTruthy();
    expect(screen.getByText(/82점/)).toBeTruthy();
  });
});

describe("ConfirmDialog re-verification", () => {
  const base = { meeting: { title: "킥오프", attendees: ["김민지"], requiredAttendees: ["김민지"] }, candidate, loading: false, error: "", onClose: vi.fn(), onConfirm: vi.fn(), onRetry: vi.fn(), onRecheck: vi.fn() };
  it("blocks approval until the latest check passes and offers a way out on conflict", () => {
    const { rerender } = render(<ConfirmDialog {...base} verify={{ state: "checking", message: "" }} />);
    expect((screen.getByRole("button", { name: "확인 중..." }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<ConfirmDialog {...base} verify={{ state: "ok", message: "방금 다시 확인했어요." }} />);
    expect((screen.getByRole("button", { name: "회의 확정하기" }) as HTMLButtonElement).disabled).toBe(false);
    rerender(<ConfirmDialog {...base} verify={{ state: "failed", message: "민지님의 일정이 맞지 않아요." }} />);
    expect(screen.queryByRole("button", { name: "회의 확정하기" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "새로운 추천 보기" }));
    expect(base.onRetry).toHaveBeenCalled();
  });
});
