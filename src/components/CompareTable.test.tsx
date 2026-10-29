// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompareTable, type CompareColumn } from "./CompareTable";

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

  it("opens as a full-screen vertical card view on mobile and closes with Escape", () => {
    media(true);
    const onClose = vi.fn();
    render(<CompareTable columns={columns} onClose={onClose} />);
    expect(screen.getByRole("dialog", { name: "추천 시간 비교" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByRole("region").length).toBe(2);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
