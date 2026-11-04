// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompareBar, CompareTable, describeColumns, splitSlot, type CompareColumn } from "./CompareTable";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const select = vi.fn();
const columns: CompareColumn[] = [
  { id: "a", label: "10월 30일 금요일 오후 2:30", required: "충돌 없음", possible: 1, impossible: 0, waiting: 1, unknown: 0, onSelect: select },
  { id: "b", label: "11월 2일 월요일 오전 9:00", required: "확인 필요", possible: 2, impossible: 0, waiting: 0, unknown: 0 },
];
const media = (matches: boolean) => vi.stubGlobal("matchMedia", () => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

describe("CompareTable responsive", () => {
  it("is a side-by-side table on web with a time-labeled select action only for selectable candidates", () => {
    media(false);
    render(<CompareTable columns={columns} />);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByText("추천 시간 2개 비교")).toBeTruthy();
    expect((screen.getByRole("button", { name: "오전 9시 선택할 수 없어요. 필수 참석자 일정 확인이 필요해요" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "오후 2시 30분 선택" }));
    expect(select).toHaveBeenCalled();
  });

  it("opens a full-screen compare view on mobile with vertical cards (no table) and a single close button; Escape closes", () => {
    media(true);
    const onClose = vi.fn();
    const { rerender } = render(<CompareTable columns={columns} onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "추천 시간 2개 비교" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByRole("region").length).toBe(2);
    expect(screen.getAllByRole("button", { name: "비교 접기" }).length).toBe(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    const four = [...columns, { ...columns[0], id: "c" }, { ...columns[0], id: "d" }];
    rerender(<CompareTable columns={four} onClose={onClose} />);
    expect(screen.getAllByRole("region").length).toBe(4);
  });

  it("calls onSelect once even if the button is clicked repeatedly", () => {
    media(false);
    const once = vi.fn();
    render(<CompareTable columns={[{ ...columns[0], onSelect: once }]} />);
    const button = screen.getByRole("button", { name: "오후 2시 30분 선택" });
    fireEvent.click(button); fireEvent.click(button);
    expect(once).toHaveBeenCalledTimes(1);
  });
});

describe("recommendation wording from real numbers only", () => {
  const same = (id: string, label: string): CompareColumn => ({ id, label, required: "충돌 없음", possible: 2, impossible: 1, waiting: 1, unknown: 0, onSelect: vi.fn() });

  it("does not crown a single winner when the top candidates have identical numbers", () => {
    const info = describeColumns([same("a", "11월 5일 (목) 오후 01:00"), same("b", "11월 5일 (목) 오후 04:00"), { ...same("c", "11월 5일 (목) 오전 10:00"), possible: 1, waiting: 2 }]);
    expect(info.isTied).toBe(true);
    expect(info.badge(info.tied[0])).toBe("동일한 수준");
    expect(info.reason).toContain("오후 1시와 오후 4시는");
    expect(info.reason).toContain("두 시간 모두 선택 참석자 1명의 응답을 기다리고 있습니다");
    expect(info.reason).not.toContain("가장");
  });

  it("marks one current recommendation only when the numbers differ, and states only the real difference", () => {
    const info = describeColumns([same("a", "11월 5일 (목) 오후 01:00"), { ...same("b", "11월 5일 (목) 오후 04:00"), possible: 1 }]);
    expect(info.isTied).toBe(false);
    expect(info.badge(info.tied[0])).toBe("현재 추천");
    expect(info.badge(info.tied[0])).not.toBe("동일한 수준");
    expect(info.reason).toContain("다른 후보보다 참석 가능한 인원이 많아요");
  });

  it("shows the waiting notice only when someone is waiting, and splits clock and date for display", () => {
    media(false);
    const { rerender } = render(<CompareTable columns={[same("a", "11월 5일 (목) 오후 01:00")]} />);
    expect(screen.getByText("아직 응답하지 않은 참석자가 있어요")).toBeTruthy();
    rerender(<CompareTable columns={[{ ...same("a", "11월 5일 (목) 오후 01:00"), waiting: 0 }]} />);
    expect(screen.queryByText("아직 응답하지 않은 참석자가 있어요")).toBeNull();
    expect(splitSlot("11월 5일 (목) 오후 01:00")).toEqual({ date: "11월 5일 (목)", clock: "오후 1:00", spoken: "오후 1시" });
    expect(splitSlot("10월 30일 금요일 오후 2:30").spoken).toBe("오후 2시 30분");
  });
});

describe("CompareBar", () => {
  it("needs two picks before it opens", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<CompareBar count={1} onOpen={onOpen} onClear={vi.fn()} />);
    expect((screen.getByRole("button", { name: "2개 이상 선택해 주세요" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<CompareBar count={2} onOpen={onOpen} onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "2개 비교하기" }));
    expect(onOpen).toHaveBeenCalled();
  });
});
