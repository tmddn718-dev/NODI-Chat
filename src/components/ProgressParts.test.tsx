// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CompletedConditions, ProgressHeader } from "./ProgressParts";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const info = { stage: 2 as const, status: "응답 대기", title: "참석 가능 여부를 확인 중이에요", helper: "2명이 아직 응답하지 않았어요", next: "현재 후보 먼저 확인하기" };
const media = (matches: boolean) => vi.stubGlobal("matchMedia", () => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }));

describe("progress parts", () => {
  it("keeps step, status and helper in one compact line and expands the four stages on web", () => {
    media(false);
    render(<ProgressHeader info={info} />);
    expect(screen.getByText("2/4 · 가능한 시간 찾기")).toBeTruthy();
    expect(screen.getByText("응답 대기")).toBeTruthy();
    expect(screen.getByText("2명이 아직 응답하지 않았어요")).toBeTruthy();
    expect(screen.queryByText("추천 시간 결정하기")).toBeNull(); // 4개 단계명은 펼칠 때만
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getByText("회의 조건 정하기").closest("li")?.textContent).toContain("완료");
    expect(screen.getByText("추천 시간 결정하기").closest("li")?.textContent).toContain("예정");
    expect(screen.getByText(/다음 행동 · 현재 후보 먼저 확인하기/)).toBeTruthy();
  });

  it("opens the stage details as a bottom sheet on mobile", () => {
    media(true);
    render(<ProgressHeader info={info} />);
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    expect(screen.getByRole("dialog", { name: "진행 상태" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("folds answered questions into editable chips", () => {
    const onEdit = vi.fn();
    render(<CompletedConditions meeting={{ title: "킥오프", durationMinutes: 60, attendees: ["김민지", "박준호"], requiredAttendees: [] }} onEdit={onEdit} />);
    expect(screen.getByRole("button", { name: "참석자 2명 수정" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "필수 없음 수정" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "시간 60분 수정" }));
    expect(onEdit).toHaveBeenCalledWith("durationMinutes");
  });
});
