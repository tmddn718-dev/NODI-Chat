// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProgressHeader } from "./ProgressParts";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const info = { stage: 2 as const, status: "응답 대기", title: "참석 가능 여부를 확인 중이에요", helper: "2명이 아직 응답하지 않았어요", next: "현재 후보 먼저 확인하기" };
const media = (matches: boolean) => vi.stubGlobal("matchMedia", () => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

describe("progress parts", () => {
  it("shows only a status chip and the current task, and expands the four stages on web", () => {
    media(false);
    render(<ProgressHeader info={{ ...info, sub: "질문 4/8 · 참석자" }} />);
    expect(screen.getByText("응답 대기")).toBeTruthy();
    expect(screen.getByText("2명이 아직 응답하지 않았어요")).toBeTruthy();
    expect(screen.queryByText("2/4 · 참석 가능 시간 수집")).toBeNull(); // 단계 번호는 펼칠 때만
    expect(screen.queryByText("추천 후보 비교")).toBeNull();
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("질문 4/8 · 참석자")).toBeTruthy();
    expect(screen.getByText("회의 조건 입력").closest("li")?.textContent).toContain("완료");
    expect(screen.getByText("추천 후보 비교").closest("li")?.textContent).toContain("예정");
    expect(screen.getByText(/다음 행동 · 현재 후보 먼저 확인하기/)).toBeTruthy();
  });

  it("labels the input stage as '조건 입력 중' with the current question name", () => {
    media(false);
    render(<ProgressHeader info={{ stage: 1, status: "입력 중", title: "회의 조건을 입력하고 있어요", helper: "", next: "질문 4/8 답하기", task: "참석자", sub: "질문 4/8 · 참석자", count: "4/8" }} />);
    expect(screen.getByText("조건 입력 중")).toBeTruthy();
    expect(screen.getByText("참석자")).toBeTruthy();
    expect(screen.queryByText("4/8")).toBeNull();
  });

  it("opens the stage details as a bottom sheet on mobile", () => {
    media(true);
    render(<ProgressHeader info={info} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByRole("dialog", { name: "진행 상태" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
