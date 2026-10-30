// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ draft: vi.fn(), saveDraft: vi.fn(), people: vi.fn(), chat: vi.fn() }));
vi.mock("../api", () => ({
  ApiError: class ApiError extends Error { constructor(message: string, readonly status: number, readonly code?: string) { super(message); } },
  api: { draft: mocks.draft, saveDraft: mocks.saveDraft, people: mocks.people, directory: vi.fn().mockResolvedValue({ total: 0, departments: [] }), chat: mocks.chat, deleteDraft: vi.fn().mockResolvedValue(undefined), invitationAvailability: vi.fn() },
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
const pickFirst = () => fireEvent.click(document.querySelector(".guided-options button")!);

describe("direct input follows the scheduling flow", () => {
  it("moves through title → purpose → duration → attendees → required people → preferred time", async () => {
    render(<ChatScreen models={["m"]} onSettings={() => undefined} onShowMeetings={() => undefined} onShowInvited={() => undefined} onShowCalendars={() => undefined} onConfirmed={() => undefined} />);
    await waitFor(() => expect(heading()).toBe("어떤 회의를 잡을까요?"));

    // 종류·목적·시간도 카드 안 입력칸 없이 채팅 입력창으로 안내해요
    fireEvent.click(screen.getByRole("button", { name: "직접 입력할게요" }));
    expect(screen.queryByRole("textbox", { name: /직접 입력/ })).toBeNull();
    expect((document.getElementById("chat-input") as HTMLTextAreaElement).placeholder).not.toBe("");
    // 서버가 아무 조건도 이해하지 못하면 값을 만들지 않고, 목록에서 가장 가까운 항목만 추천해요
    mocks.chat.mockResolvedValue({ intent: "unknown", assistantMessage: "잘 모르겠어요.", meeting: { timezone: "Asia/Seoul", version: 1 }, changedFields: [], proposedFields: {}, ambiguities: [], nextAction: { type: "ask", field: "title" }, issues: [], complete: false, model: "m" });
    const box = document.getElementById("chat-input") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "킥오프 미팅" } });
    fireEvent.submit(box.closest("form")!);
    await waitFor(() => expect(document.querySelector(".guided-options .recommended")?.textContent).toContain("프로젝트 킥오프"));
    expect(heading()).toBe("어떤 회의를 잡을까요?");
    pickFirst();
    await waitFor(() => expect(heading()).toBe("무엇을 위한 회의인가요?"));
    pickFirst();
    await waitFor(() => expect(heading()).toBe("얼마나 진행할까요?"));
    pickFirst();
    await waitFor(() => expect(heading()).toBe("누구와 함께하나요?"));

    // 직접 입력은 카드 안 입력칸 없이 채팅 입력창으로 넘어가요
    fireEvent.click(await screen.findByRole("button", { name: "직접 입력할게요" }));
    expect(screen.queryByLabelText("참석자 직접 입력")).toBeNull();
    expect((document.getElementById("chat-input") as HTMLTextAreaElement).placeholder).toContain("김민지");
    // 채팅에 이름을 쓰면 AI 없이 목록에서 찾아 카드에 자동으로 체크돼요
    await screen.findAllByRole("button", { name: /김민지/ });
    const callsBefore = mocks.chat.mock.calls.length;
    const nameBox = document.getElementById("chat-input") as HTMLTextAreaElement;
    fireEvent.change(nameBox, { target: { value: "김민지랑 같이 해요" } });
    fireEvent.submit(nameBox.closest("form")!);
    expect(await screen.findByText(/김민지님을 참석자로 체크했어요/)).toBeTruthy();
    expect(mocks.chat.mock.calls.length).toBe(callsBefore); // AI를 거치지 않았어요
    fireEvent.click(await screen.findByRole("button", { name: "이 사람들과 계속" })); // 체크가 반영되면 계속 버튼이 켜져요
    await waitFor(() => expect(heading()).toBe("이 회의를 진행하려면 반드시 참석해야 하는 사람은 누구인가요?"));
    fireEvent.click(screen.getByRole("button", { name: "직접 알려주기" }));
    expect((document.getElementById("chat-input") as HTMLTextAreaElement).placeholder).toContain("꼭 참석");
    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    await waitFor(() => expect(heading()).toBe("언제가 편한가요?"));
    // 선호 시간대는 카드 안 입력칸이 아니라 채팅 입력창으로 안내해요
    fireEvent.click(screen.getByRole("button", { name: "직접 입력할게요" }));
    expect(screen.queryByRole("button", { name: "확인" })).toBeNull();
    expect((document.getElementById("chat-input") as HTMLTextAreaElement).placeholder).toBe("예: 오후 2시 이후가 좋아");
  }, 20_000);
});

describe("natural language understanding", () => {
  it("applies several conditions from one sentence, skips answered steps and shows a proposal for vague values", async () => {
    render(<ChatScreen models={["m"]} onSettings={() => undefined} onShowMeetings={() => undefined} onShowInvited={() => undefined} onShowCalendars={() => undefined} onConfirmed={() => undefined} />);
    await waitFor(() => expect(heading()).toBe("어떤 회의를 잡을까요?"));
    mocks.chat.mockResolvedValue({
      intent: "create_meeting", assistantMessage: "민지님과 리뷰로 이해했어요.",
      meeting: { timezone: "Asia/Seoul", version: 1, title: "업무 리뷰", attendees: ["김민지"] },
      changedFields: ["title", "attendees"], proposedFields: { durationMinutes: 30 }, ambiguities: [],
      nextAction: { type: "confirm_proposal", field: "durationMinutes" }, issues: [], complete: false, model: "m",
    });
    const box = document.getElementById("chat-input") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "민지랑 짧게 리뷰하고 싶어" } });
    fireEvent.submit(box.closest("form")!);
    expect(await screen.findByText("이렇게 이해했어요")).toBeTruthy();
    expect(document.querySelector(".understood-card")?.textContent).toContain("김민지");
    expect(document.querySelector(".proposal-card")?.textContent).toContain("30분"); // 제안일 뿐 확정 전
    expect(heading()).not.toBe("어떤 회의를 잡을까요?");
    fireEvent.click(screen.getByRole("button", { name: /이대로 할게요/ }));
    await waitFor(() => expect(screen.queryByLabelText("제안 확인")).toBeNull());
  }, 20_000);
});

describe("ambiguous input", () => {
  it("shows interpretation choices instead of silently changing the meeting type, and keeps typing available", async () => {
    render(<ChatScreen models={["m"]} onSettings={() => undefined} onShowMeetings={() => undefined} onShowInvited={() => undefined} onShowCalendars={() => undefined} onConfirmed={() => undefined} />);
    await waitFor(() => expect(heading()).toBe("어떤 회의를 잡을까요?"));
    pickFirst();
    await waitFor(() => expect(heading()).toBe("무엇을 위한 회의인가요?"));
    mocks.chat.mockResolvedValue({
      intent: "update_condition", assistantMessage: "아이디어 회의로 이해했어요.",
      meeting: { timezone: "Asia/Seoul", version: 2, title: "팀 정기 회의" }, changedFields: [], proposedFields: {}, ambiguities: [],
      nextAction: { type: "resolve_ambiguity", ambiguity: { field: "purpose", type: "multiple_meanings", rawText: "아이디어 회의", options: [
        { id: "a", label: "아이디어를 다양하게 모으기", patch: { purpose: "다양한 아이디어 도출" } },
        { id: "b", label: "회의 종류를 아이디어 회의로 변경", patch: { title: "아이디어 회의" } },
      ] } }, issues: [], complete: false, model: "m",
    });
    const box = document.getElementById("chat-input") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "아이디어 회의입니다 정말로" } });
    fireEvent.submit(box.closest("form")!);
    expect(await screen.findByLabelText("해석 선택")).toBeTruthy();
    expect(mocks.chat.mock.calls[0][0].currentField).toBe("purpose");
    expect(screen.getByRole("button", { name: "직접 입력할게요" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "아이디어를 다양하게 모으기" }));
    await waitFor(() => expect(heading()).toBe("얼마나 진행할까요?")); // 목적만 정해지고 종류는 그대로
  }, 20_000);
});

describe("understood card", () => {
  it("reverts a single understood field", async () => {
    render(<ChatScreen models={["m"]} onSettings={() => undefined} onShowMeetings={() => undefined} onShowInvited={() => undefined} onShowCalendars={() => undefined} onConfirmed={() => undefined} />);
    await waitFor(() => expect(heading()).toBe("어떤 회의를 잡을까요?"));
    mocks.chat.mockResolvedValue({ intent: "create_meeting", assistantMessage: "이해했어요.", meeting: { timezone: "Asia/Seoul", version: 1, title: "업무 리뷰", durationMinutes: 30 }, changedFields: ["title", "durationMinutes"], proposedFields: {}, ambiguities: [], nextAction: { type: "ask", field: "purpose" }, issues: [], complete: false, model: "m" });
    const box = document.getElementById("chat-input") as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "30분 업무 리뷰 하고 싶어요" } });
    fireEvent.submit(box.closest("form")!);
    fireEvent.click(await screen.findByRole("button", { name: "시간 되돌리기" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "시간 되돌리기" })).toBeNull());
    expect(screen.getByRole("button", { name: "회의 종류 되돌리기" })).toBeTruthy();
  }, 20_000);
});

describe("new conversation", () => {
  it("clears meeting data and every pending card", async () => {
    render(<ChatScreen models={["m"]} onSettings={() => undefined} onShowMeetings={() => undefined} onShowInvited={() => undefined} onShowCalendars={() => undefined} onConfirmed={() => undefined} />);
    await waitFor(() => expect(heading()).toBe("어떤 회의를 잡을까요?"));
    pickFirst();
    await waitFor(() => expect(heading()).toBe("무엇을 위한 회의인가요?"));
    pickFirst();
    await waitFor(() => expect(heading()).toBe("얼마나 진행할까요?"));
    fireEvent.click(screen.getAllByRole("button", { name: "새 대화" })[0]);
    // 작성 중인 내용이 있으면 한 번 확인해요
    fireEvent.click(await screen.findByRole("button", { name: "새로 시작하기" }));
    await waitFor(() => expect(heading()).toBe("어떤 회의를 잡을까요?"));
    expect(screen.queryByLabelText("제안 확인")).toBeNull();
    expect(screen.queryByLabelText("이렇게 이해했어요")).toBeNull();
    expect(document.querySelector(".summary-card")?.textContent).not.toContain("팀 정기 회의");
    const saved = JSON.parse(localStorage.getItem("nodi_meeting_draft_v2") ?? "{}");
    expect(saved.meeting?.title).toBeUndefined(); // 자동 저장이 다시 쓴 건 빈 초안뿐이에요
  }, 20_000);
});

describe("welcome area", () => {
  it("shows one short greeting at first entry and nothing once the conversation started", async () => {
    render(<ChatScreen models={["m"]} onSettings={() => undefined} onShowMeetings={() => undefined} onShowInvited={() => undefined} onShowCalendars={() => undefined} onConfirmed={() => undefined} />);
    await waitFor(() => expect(heading()).toBe("어떤 회의를 잡을까요?"));
    expect(screen.getByText("안녕하세요. 어떤 회의를 잡을까요?")).toBeTruthy();
    expect(screen.queryByText("반가워요. NODI예요.")).toBeNull(); // 큰 환영 문구는 없어요
    pickFirst();
    await waitFor(() => expect(heading()).toBe("무엇을 위한 회의인가요?"));
    expect(screen.queryByText("안녕하세요. 어떤 회의를 잡을까요?")).toBeNull();
  }, 20_000);

  it("does not ask for confirmation when nothing has been entered yet", async () => {
    render(<ChatScreen models={["m"]} onSettings={() => undefined} onShowMeetings={() => undefined} onShowInvited={() => undefined} onShowCalendars={() => undefined} onConfirmed={() => undefined} />);
    await waitFor(() => expect(heading()).toBe("어떤 회의를 잡을까요?"));
    fireEvent.click(screen.getAllByRole("button", { name: "새 대화" })[0]);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
