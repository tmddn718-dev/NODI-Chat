// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invitationAvailability: vi.fn(),
  draft: vi.fn(),
  saveDraft: vi.fn(),
}));

vi.mock("../api", () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
  },
  api: {
    draft: mocks.draft,
    saveDraft: mocks.saveDraft,
    invitationAvailability: mocks.invitationAvailability,
    deleteDraft: vi.fn().mockResolvedValue(undefined),
  },
}));

import { ChatScreen } from "./ChatScreen";

const storageKey = "nodi_meeting_draft_v2";

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  mocks.draft.mockResolvedValue({ draft: null });
  mocks.saveDraft.mockImplementation(async (_version, payload) => ({
    draft: { version: 1, payload, createdAt: "2026-10-27T00:00:00.000Z", updatedAt: "2026-10-27T00:00:00.000Z" },
  }));
  mocks.invitationAvailability.mockResolvedValue({
    availability: [{ attendee: "김민지", status: "available", start: "2026-10-28T09:00:00+09:00", end: "2026-10-28T12:00:00+09:00" }],
    updatedAt: "2026-10-27T12:34:56.000Z",
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe("ChatScreen invitation responses", () => {
  it("automatically applies the latest attendee response", async () => {
    localStorage.setItem(storageKey, JSON.stringify({
      meeting: {
        title: "프로젝트 킥오프",
        purpose: "일정과 담당 업무 결정",
        durationMinutes: 30,
        attendees: ["김민지"],
        requiredAttendees: ["김민지"],
        preferredTime: "any",
        dateStart: "2026-10-28",
        dateEnd: "2026-10-30",
        timezone: "Asia/Seoul",
        version: 8,
      },
      availability: [{ attendee: "김민지", status: "no_response" }],
      messages: [],
      invitationToken: "c".repeat(48),
      invitationLinks: [{ attendee: "김민지", urlToken: "d".repeat(48) }],
      invitationRequestId: "request-1",
      language: "ko",
      model: "llama-3.3-70b-versatile",
      savedAt: "2026-10-27T00:00:00.000Z",
    }));

    render(<ChatScreen models={["llama-3.3-70b-versatile"]} onSettings={() => undefined} onShowMeetings={() => undefined} onConfirmed={() => undefined} />);

    await waitFor(() => expect(screen.getByText("1/1명 응답")).toBeTruthy());
    expect(mocks.invitationAvailability).toHaveBeenCalledWith("c".repeat(48));
    expect((screen.getByLabelText("김민지 참석 상태") as HTMLSelectElement).value).toBe("available");
    expect(screen.getByText("새 답변을 자동으로 확인해요")).toBeTruthy();
  });
});

describe("ChatScreen previous step", () => {
  it("returns to the earlier question after a guided choice", async () => {
    render(<ChatScreen models={["m"]} onSettings={() => undefined} onShowMeetings={() => undefined} onConfirmed={() => undefined} />);
    await waitFor(() => expect(mocks.draft).toHaveBeenCalled());
    expect(screen.queryByText("이전 단계로")).toBeNull();
    const first = document.querySelector(".guided-card h2")!.textContent;
    fireEvent.click(document.querySelector(".guided-options button")!);
    await waitFor(() => expect(document.querySelector(".guided-card h2")!.textContent).not.toBe(first));
    fireEvent.click(screen.getByText("이전 단계로"));
    await waitFor(() => expect(document.querySelector(".guided-card h2")!.textContent).toBe(first));
    expect(screen.queryByText("이전 단계로")).toBeNull();
    fireEvent.click(screen.getByText("되돌리기"));
    await waitFor(() => expect(document.querySelector(".guided-card h2")!.textContent).not.toBe(first));
    expect(screen.getByText("이전 단계로")).toBeTruthy();
  });
});
