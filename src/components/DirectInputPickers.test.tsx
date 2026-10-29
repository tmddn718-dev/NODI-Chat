// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "./DateRangePicker";
import { RequiredAttendeePicker } from "./RequiredAttendeePicker";

afterEach(cleanup);

// 직접 입력은 카드 안 입력칸이 아니라 채팅 입력창으로 넘겨요.
describe("picker direct input", () => {
  it("DateRangePicker hands off to the chat composer", () => {
    const onDirectInput = vi.fn();
    render(<DateRangePicker language="ko" today="2026-10-28" onConfirm={vi.fn()} onDirectInput={onDirectInput} />);
    fireEvent.click(screen.getByRole("button", { name: "직접 입력할게요" }));
    expect(onDirectInput).toHaveBeenCalled();
    expect(screen.queryByLabelText("시작일")).toBeNull();
  });

  it("RequiredAttendeePicker hands off to the chat composer", () => {
    const onDirectInput = vi.fn();
    render(<RequiredAttendeePicker attendees={["김민지", "박준호"]} language="ko" onConfirm={vi.fn()} onDirectInput={onDirectInput} />);
    fireEvent.click(screen.getByRole("button", { name: "직접 알려주기" }));
    expect(onDirectInput).toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: /직접 입력/ })).toBeNull();
  });
});
