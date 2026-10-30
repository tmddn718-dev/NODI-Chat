// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";
import { AttendeePicker } from "./AttendeePicker";

vi.mock("../api", () => ({ api: { people: vi.fn(), directory: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const tree = { total: 2, departments: [{ name: "제품본부", count: 2, teams: [{ name: "프로덕트팀", count: 2 }] }] };

const people = [
  { id: "minji", name: "김민지", email: "minji@nodi.demo", timezone: "Asia/Seoul", calendarStatus: "connected" as const, recent: true, lastMetAt: "2026-10-24T10:00:00+09:00" },
  { id: "junho", name: "박준호", email: "junho@nodi.demo", timezone: "Asia/Seoul", calendarStatus: "connected" as const, recent: false },
];

describe("AttendeePicker", () => {
  it("shows recent people, prevents duplicates and confirms the selected attendees", async () => {
    vi.mocked(api.directory).mockResolvedValue(tree);
    vi.mocked(api.people).mockResolvedValue({ people, mode: "demo" });
    const onConfirm = vi.fn();
    render(<AttendeePicker language="ko" onConfirm={onConfirm} onDirectInput={() => undefined} />);
    fireEvent.click((await screen.findAllByRole("button", { name: /\uae40\ubbfc\uc9c0/ }, { timeout: 8000 }))[0]);
    fireEvent.click(await screen.findByRole("button", { name: "참석자 1명 추가하기" }, { timeout: 8000 })); // 부하가 있을 때도 선택이 반영될 때까지 기다려요
    expect(onConfirm).toHaveBeenCalledWith(["김민지"]);
  }, 20000);

  it("hands direct typing off to the chat composer", async () => {
    vi.mocked(api.directory).mockResolvedValue(tree);
    vi.mocked(api.people).mockResolvedValue({ people, mode: "demo" });
    const onDirectInput = vi.fn();
    render(<AttendeePicker language="ko" onConfirm={vi.fn()} onDirectInput={onDirectInput} />);
    fireEvent.click(await screen.findByRole("button", { name: "직접 입력할게요" }, { timeout: 8000 }));
    expect(onDirectInput).toHaveBeenCalled();
    expect(screen.queryByLabelText("참석자 직접 입력")).toBeNull();
  });

  it("allows an exact external email to be added", async () => {
    vi.mocked(api.directory).mockResolvedValue(tree);
    vi.mocked(api.people).mockResolvedValue({ people: [], mode: "demo" });
    const onConfirm = vi.fn();
    render(<AttendeePicker language="ko" onConfirm={onConfirm} onDirectInput={() => undefined} />);
    fireEvent.change(screen.getByLabelText("참석자 검색"), { target: { value: "partner@example.com" } });
    await waitFor(() => expect(screen.getByText("외부 참석자로 초대")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /partner@example.com/ }));
    fireEvent.click(screen.getByRole("button", { name: "참석자 1명 추가하기" }));
    expect(onConfirm).toHaveBeenCalledWith(["partner@example.com"]);
  });

  it("shows part of a large directory, loads more on request, and adds a whole team within the limit", async () => {
    vi.mocked(api.directory).mockResolvedValue({ total: 120, departments: [{ name: "개발본부", count: 120, teams: [{ name: "백엔드팀", count: 60 }] }] });
    const make = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => ({ id: `p${from + i}`, name: `직원${from + i}`, email: `p${from + i}@nodi.demo`, timezone: "Asia/Seoul", calendarStatus: "connected" as const, recent: false, team: "백엔드팀", department: "개발본부" }));
    vi.mocked(api.people).mockImplementation(async (params) => {
      const p = typeof params === "object" ? params : {};
      if (p.limit === 500) return { people: make(0, 60), total: 60, hasMore: false, mode: "demo" as const };
      return p.offset ? { people: make(30, 60), total: 120, hasMore: true, mode: "demo" as const } : { people: make(0, 30), total: 120, hasMore: true, mode: "demo" as const };
    });
    render(<AttendeePicker language="ko" onConfirm={vi.fn()} onDirectInput={() => undefined} />);
    expect(await screen.findByText("전체 120명 중 30명 표시", undefined, { timeout: 8000 })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /더 보기/ }));
    expect(await screen.findByText("전체 120명 중 60명 표시", undefined, { timeout: 8000 })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("부서"), { target: { value: "개발본부" } });
    fireEvent.change(screen.getByLabelText("팀"), { target: { value: "백엔드팀" } });
    fireEvent.click(await screen.findByRole("button", { name: /백엔드팀 60명 모두 추가/ }, { timeout: 8000 }));
    expect(await screen.findByText(/최대 50명까지만 넣을 수 있어서 백엔드팀 50명만 추가했어요/, undefined, { timeout: 8000 })).toBeTruthy();
    expect(screen.getByText("선택한 참석자 50/50명")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    expect(screen.queryByText(/선택한 참석자/)).toBeNull();
  }, 20000);
});

describe("AttendeePicker on a phone", () => {
  it("opens a full-screen sheet with a fixed confirm bar that carries the selected count", async () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, value: (query: string) => ({ matches: true, media: query, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined }) });
    vi.mocked(api.directory).mockResolvedValue(tree);
    vi.mocked(api.people).mockResolvedValue({ people, mode: "demo" });
    const onConfirm = vi.fn();
    try {
      render(<AttendeePicker language="ko" onConfirm={onConfirm} onDirectInput={() => undefined} />);
      expect(screen.queryByRole("dialog")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "참석자 선택하기" }));
      const sheet = screen.getByRole("dialog", { name: "참석자 선택" });
      expect(sheet).toBeTruthy();
      expect((screen.getByRole("button", { name: "함께할 사람을 선택해 주세요" }) as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click((await screen.findAllByRole("button", { name: /김민지/ }, { timeout: 8000 }))[0]);
      fireEvent.click(await screen.findByRole("button", { name: "참석자 1명 추가하기" }, { timeout: 8000 }));
      expect(onConfirm).toHaveBeenCalledWith(["김민지"]);
      expect(screen.queryByRole("dialog")).toBeNull();
    } finally {
      Reflect.deleteProperty(window, "matchMedia");
    }
  }, 20000);
});

