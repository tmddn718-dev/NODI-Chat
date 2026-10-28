// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ draft: vi.fn(), saveDraft: vi.fn(), people: vi.fn() }));
vi.mock("../api", () => ({
  ApiError: class ApiError extends Error { constructor(message: string, readonly status: number, readonly code?: string) { super(message); } },
  api: { draft: mocks.draft, saveDraft: mocks.saveDraft, people: mocks.people, deleteDraft: vi.fn().mockResolvedValue(undefined), invitationAvailability: vi.fn() },
}));
import { ChatScreen } from "./ChatScreen";

const person = { id: "minji", name: "김민지", email: "minji@nodi.demo", timezone: "Asia/Seoul", calendarStatus: "connected" as const, recent: true, title: "프로덕트 매니저", team: "프로덕트팀" };
beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  mocks.draft.mockResolvedValue({ draft: null });
  mocks.saveDraft.mockImplementation(async (_v, payload) => ({ draft: { version: 1, payload, createdAt: "", updatedAt: "" } }));
  mocks.people.mockResolvedValue({ people: [person], mode: "demo" });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const heading = () => document.querySelector(".guided-card h2, .attendee-picker h2, .required-picker h2")?.textContent;
const directly = (label: string, value: string) => {
  fireEvent.click(screen.getByRole("button", { name: "직접 입력할게요" }));
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "확인" }));
};

describe("direct input follows the scheduling flow", () => {
  it("moves through title → purpose → duration → attendees → required people → preferred time", async () => {
    render(<ChatScreen models={["m"]} onSettings={() => undefined} onShowMeetings={() => undefined} onShowInvited={() => undefined} onShowCalendars={() => undefined} onConfirmed={() => undefined} />);
    await waitFor(() => expect(heading()).toBe("어떤 회의를 잡을까요?"));

    directly("회의 종류 직접 입력", "신규 서비스 출시 준비");
    await waitFor(() => expect(heading()).toBe("무엇을 위한 회의인가요?"));
    expect(screen.getByText("회의 종류는 신규 서비스 출시 준비야.")).toBeTruthy(); // 내 말로 대화에 남아요

    directly("회의 목적 직접 입력", "출시 일정과 담당 결정");
    await waitFor(() => expect(heading()).toBe("얼마나 진행할까요?"));

    fireEvent.click(screen.getByRole("button", { name: "직접 입력할게요" }));
    fireEvent.change(screen.getByLabelText("회의 시간 직접 입력"), { target: { value: "3" } });
    expect((screen.getByRole("button", { name: "확인" }) as HTMLButtonElement).disabled).toBe(true); // 5분 미만은 막아요
    fireEvent.change(screen.getByLabelText("회의 시간 직접 입력"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    await waitFor(() => expect(heading()).toBe("누구와 함께하나요?"));

    fireEvent.click(await screen.findByRole("button", { name: "직접 입력할게요" }));
    fireEvent.change(screen.getByLabelText("참석자 직접 입력"), { target: { value: "홍길동" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));
    expect(screen.getByRole("note").textContent).toContain("홍길동"); // 디렉터리에 없는 이름은 안내해요
    fireEvent.click(screen.getByRole("button", { name: "이 사람들과 계속" }));
    await waitFor(() => expect(heading()).toBe("누가 꼭 참석해야 하나요?"));

    fireEvent.click(screen.getByRole("button", { name: /홍길동/ })); // 직접 추가한 사람도 꼭 참석자로 고를 수 있어요
    fireEvent.click(screen.getByRole("button", { name: "이대로 계속" }));
    await waitFor(() => expect(heading()).toBe("언제가 편한가요?"));
    // 선호 시간대는 카드 안 입력칸이 아니라 채팅 입력창으로 안내해요
    fireEvent.click(screen.getByRole("button", { name: "직접 입력할게요" }));
    expect(screen.queryByRole("button", { name: "확인" })).toBeNull();
    expect((document.getElementById("chat-input") as HTMLTextAreaElement).placeholder).toBe("예: 오후 2시 이후가 좋아");
  });
});
