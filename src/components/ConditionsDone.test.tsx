// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConditionsDone } from "./ConditionsDone";

afterEach(cleanup);

describe("ConditionsDone", () => {
  it("summarizes the finished conditions and toggles the earlier conversation", () => {
    const onToggle = vi.fn();
    const meeting = { title: "1:1 미팅", durationMinutes: 60, attendees: ["가", "나", "다"] };
    const { rerender } = render(<ConditionsDone meeting={meeting} hiddenCount={9} open={false} onToggle={onToggle} />);
    expect(screen.getByText("회의 조건 설정 완료")).toBeTruthy();
    expect(screen.getByText("1:1 미팅 · 60분 · 참석자 3명")).toBeTruthy();
    expect(screen.getByText("이전 대화 9개 보기")).toBeTruthy();
    const card = screen.getByRole("button", { expanded: false });
    fireEvent.click(card);
    expect(onToggle).toHaveBeenCalled();
    rerender(<ConditionsDone meeting={meeting} hiddenCount={9} open onToggle={onToggle} />);
    expect(screen.getByText("이전 대화 접기")).toBeTruthy();
    expect(screen.getByRole("button", { expanded: true })).toBeTruthy();
  });
});
