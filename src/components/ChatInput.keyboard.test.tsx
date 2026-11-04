// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ draft: vi.fn(), saveDraft: vi.fn(), people: vi.fn(), chat: vi.fn() }));
vi.mock("../api", () => ({
  ApiError: class ApiError extends Error { constructor(message: string, readonly status: number, readonly code?: string) { super(message); } },
  api: { draft: mocks.draft, saveDraft: mocks.saveDraft, people: mocks.people, directory: vi.fn().mockResolvedValue({ total: 0, departments: [] }), chat: mocks.chat, deleteDraft: vi.fn().mockResolvedValue({ ok: true }) },
}));
import { ChatScreen } from "./ChatScreen";

const heading = () => document.querySelector(".guided-card h2, .attendee-picker h2, .required-picker h2")?.textContent;
const media = (matches: boolean) => vi.stubGlobal("matchMedia", () => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
const open = async () => {
  render(<ChatScreen models={["m"]} onSettings={() => undefined} onShowMeetings={() => undefined} onShowInvited={() => undefined} onShowCalendars={() => undefined} onConfirmed={() => undefined} />);
  await waitFor(() => expect(heading()).toBe("어떤 회의를 잡을까요?"));
  const box = document.getElementById("chat-input") as HTMLTextAreaElement;
  fireEvent.change(box, { target: { value: "프로젝트 킥오프" } }); // 목록 항목과 똑같은 말이라 서버(AI)를 거치지 않고 바로 다음 질문으로 가요
  return box;
};

beforeEach(() => {
  localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  mocks.draft.mockResolvedValue({ draft: null });
  mocks.saveDraft.mockImplementation(async (_v, payload) => ({ draft: { version: 1, payload, createdAt: "", updatedAt: "" } }));
  mocks.people.mockResolvedValue({ people: [], mode: "demo" });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("chat input keys", () => {
  it("web: Enter sends, and the send hint is shown", async () => {
    media(false);
    const box = await open();
    expect(box.getAttribute("enterkeyhint")).toBe("send");
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(heading()).toBe("무엇을 위한 회의인가요?"));
  });

  it("a Korean IME composition's Enter never sends", async () => {
    media(false);
    const box = await open();
    fireEvent.keyDown(box, { key: "Enter", isComposing: true });
    fireEvent.keyDown(box, { key: "Enter", keyCode: 229 });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(heading()).toBe("어떤 회의를 잡을까요?");
    expect(box.value).toBe("프로젝트 킥오프");
  });

  it("mobile: Enter is a line break (not send), Ctrl/Cmd+Enter or the send button sends", async () => {
    media(true);
    const box = await open();
    expect(box.getAttribute("enterkeyhint")).toBe("enter");
    fireEvent.keyDown(box, { key: "Enter" });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(heading()).toBe("어떤 회의를 잡을까요?");
    fireEvent.keyDown(box, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(heading()).toBe("무엇을 위한 회의인가요?"));
  });
});
