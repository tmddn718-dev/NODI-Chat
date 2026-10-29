// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { AttendeePicker } from "./AttendeePicker";

vi.mock("../api", () => ({ api: { people: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const people = [
  { id: "minji", name: "김민지", email: "minji@nodi.demo", timezone: "Asia/Seoul", calendarStatus: "connected" as const, recent: true, lastMetAt: "2026-10-24T10:00:00+09:00" },
  { id: "junho", name: "박준호", email: "junho@nodi.demo", timezone: "Asia/Seoul", calendarStatus: "connected" as const, recent: false },
];

describe("AttendeePicker", () => {
  it("shows recent people, prevents duplicates and confirms the selected attendees", async () => {
    vi.mocked(api.people).mockResolvedValue({ people, mode: "demo" });
    const onConfirm = vi.fn();
    render(<AttendeePicker language="ko" onConfirm={onConfirm} onDirectInput={() => undefined} />);
    fireEvent.click((await screen.findAllByRole("button", { name: /\uae40\ubbfc\uc9c0/ }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: "이 사람들과 계속" })); // 부하가 있을 때도 선택이 반영될 때까지 기다려요
    expect(onConfirm).toHaveBeenCalledWith(["김민지"]);
  });

  it("hands direct typing off to the chat composer", async () => {
    vi.mocked(api.people).mockResolvedValue({ people, mode: "demo" });
    const onDirectInput = vi.fn();
    render(<AttendeePicker language="ko" onConfirm={vi.fn()} onDirectInput={onDirectInput} />);
    fireEvent.click(await screen.findByRole("button", { name: "직접 입력할게요" }));
    expect(onDirectInput).toHaveBeenCalled();
    expect(screen.queryByLabelText("참석자 직접 입력")).toBeNull();
  });

  it("allows an exact external email to be added", async () => {
    vi.mocked(api.people).mockResolvedValue({ people: [], mode: "demo" });
    const onConfirm = vi.fn();
    render(<AttendeePicker language="ko" onConfirm={onConfirm} onDirectInput={() => undefined} />);
    fireEvent.change(screen.getByLabelText("참석자 검색"), { target: { value: "partner@example.com" } });
    await waitFor(() => expect(screen.getByText("외부 참석자로 초대")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /partner@example.com/ }));
    fireEvent.click(screen.getByRole("button", { name: "이 사람들과 계속" }));
    expect(onConfirm).toHaveBeenCalledWith(["partner@example.com"]);
  });
});
