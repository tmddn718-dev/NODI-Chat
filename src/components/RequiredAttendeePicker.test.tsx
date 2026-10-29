// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequiredAttendeePicker } from "./RequiredAttendeePicker";

afterEach(cleanup);

describe("RequiredAttendeePicker", () => {
  it("shows every selected attendee and confirms only checked people", () => {
    const onConfirm = vi.fn();
    render(<RequiredAttendeePicker attendees={["김민지", "박준호", "partner@example.com"]} language="ko" onConfirm={onConfirm} onDirectInput={() => undefined} />);
    expect(screen.getByRole("heading", { name: "이 회의를 진행하려면 반드시 참석해야 하는 사람은 누구인가요?" })).toBeTruthy();
    expect(screen.getByText("김민지")).toBeTruthy();
    expect(screen.getByText("박준호")).toBeTruthy();
    expect(screen.getByText("partner@example.com")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /\uae40\ubbfc\uc9c0/ }));
    fireEvent.click(screen.getByRole("button", { name: /partner@example.com/ }));
    fireEvent.click(screen.getByRole("button", { name: "이대로 계속" }));
    expect(onConfirm).toHaveBeenCalledWith(["김민지", "partner@example.com"]);
  });

  it("supports explicit select all and no-required-attendee choices", () => {
    const onConfirm = vi.fn();
    render(<RequiredAttendeePicker attendees={["김민지", "박준호"]} language="ko" onConfirm={onConfirm} onDirectInput={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "모두 선택" }));
    expect(screen.getByText("2명이 꼭 참석해요")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "선택 해제" }));
    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(onConfirm).toHaveBeenCalledWith([]);
  });
});
