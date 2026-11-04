// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ draft: vi.fn(), saveDraft: vi.fn(), people: vi.fn(), chat: vi.fn() }));
vi.mock("../api", () => ({
  ApiError: class ApiError extends Error { constructor(message: string, readonly status: number, readonly code?: string) { super(message); } },
  api: { draft: mocks.draft, saveDraft: mocks.saveDraft, people: mocks.people, directory: vi.fn().mockResolvedValue({ total: 0, departments: [] }), chat: mocks.chat, deleteDraft: vi.fn().mockResolvedValue({ ok: true }) },
}));
import { ChatScreen } from "./ChatScreen";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
  mocks.draft.mockResolvedValue({ draft: null });
  mocks.saveDraft.mockImplementation(async (_v, payload) => ({ draft: { version: 1, payload, createdAt: "", updatedAt: "" } }));
  mocks.people.mockResolvedValue({ people: [], mode: "demo" });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

const renderChat = () => render(<ChatScreen models={["m"]} onSettings={() => undefined} onShowMeetings={() => undefined} onShowInvited={() => undefined} onShowCalendars={() => undefined} onConfirmed={() => undefined} />);

describe("mobile more menu", () => {
  it("closes when you tap outside it or press Escape, and gives focus back to the menu button", async () => {
    renderChat();
    const button = await screen.findByRole("button", { name: "더보기" });
    fireEvent.click(button);
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    fireEvent.click(button);
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(button);
  });

  it("stays open when you tap inside the menu", async () => {
    renderChat();
    fireEvent.click(await screen.findByRole("button", { name: "더보기" }));
    fireEvent.pointerDown(screen.getByRole("menu"));
    expect(screen.getByRole("menu")).toBeTruthy();
  });
});
