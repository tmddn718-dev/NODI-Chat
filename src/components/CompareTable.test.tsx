// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompareBar, CompareTable, type CompareColumn } from "./CompareTable";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const select = vi.fn();
const columns: CompareColumn[] = [
  { id: "a", label: "10월 30일 금요일 오후 2:30", required: "충돌 없음", possible: 1, impossible: 0, waiting: 1, unknown: 0, onSelect: select },
  { id: "b", label: "11월 2일 월요일 오전 9:00", required: "확인 필요", possible: 2, impossible: 0, waiting: 0, unknown: 0 },
];
const media = (matches: boolean) => vi.stubGlobal("matchMedia", () => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

describe("CompareTable responsive", () => {
  it("is a side-by-side table on web with a select action only for selectable candidates", () => {
    media(false);
    render(<CompareTable columns={columns} />);
    expect(screen.getByRole("table")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "선택" }));
    expect(select).toHaveBeenCalled();
  });

  it("opens a full-screen compare view on mobile: side-by-side for 2-3 picks, cards beyond that, Escape closes", () => {
    media(true);
    const onClose = vi.fn();
    const { rerender } = render(<CompareTable columns={columns} onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "추천 시간 비교" })).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy(); // 2개 → 같은 기준으로 나란히
    expect(screen.getByText("날짜·시간")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    const four = [...columns, { ...columns[0], id: "c" }, { ...columns[0], id: "d" }];
    rerender(<CompareTable columns={four} onClose={onClose} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByRole("region").length).toBe(4);
  });

  it("CompareBar needs two picks before it opens", () => {
    const onOpen = vi.fn();
    const { rerender } = render(<CompareBar count={1} onOpen={onOpen} onClear={vi.fn()} />);
    expect((screen.getByRole("button", { name: "2개 이상 선택해 주세요" }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<CompareBar count={2} onOpen={onOpen} onClear={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "2개 비교하기" }));
    expect(onOpen).toHaveBeenCalled();
  });
});
