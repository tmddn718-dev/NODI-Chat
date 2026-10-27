// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "./DateRangePicker";

afterEach(cleanup);

describe("DateRangePicker", () => {
  it("starts on the current month, blocks past dates and confirms a range", () => {
    const onConfirm = vi.fn();
    render(<DateRangePicker language="ko" today="2026-10-27" onConfirm={onConfirm} onDirectInput={() => undefined} />);

    expect(screen.getByText("2026년 10월")).toBeTruthy();
    expect((screen.getByRole("button", { name: /2026-10-26/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /2026-10-28/ }));
    fireEvent.click(screen.getByRole("button", { name: /2026-10-30/ }));
    fireEvent.click(screen.getByRole("button", { name: "이 날짜로 찾기" }));

    expect(onConfirm).toHaveBeenCalledWith("2026-10-28", "2026-10-30");
  });

  it("allows a one-day search range", () => {
    const onConfirm = vi.fn();
    render(<DateRangePicker language="ko" today="2026-10-27" onConfirm={onConfirm} onDirectInput={() => undefined} />);

    const today = screen.getByRole("button", { name: /2026-10-27/ });
    fireEvent.click(today);
    fireEvent.click(today);
    fireEvent.click(screen.getByRole("button", { name: "이 날짜로 찾기" }));

    expect(onConfirm).toHaveBeenCalledWith("2026-10-27", "2026-10-27");
  });

  it("navigates to future months but not before the current month", () => {
    render(<DateRangePicker language="ko" today="2026-10-27" onConfirm={() => undefined} onDirectInput={() => undefined} />);

    expect((screen.getByRole("button", { name: "이전 달" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "다음 달" }));
    expect(screen.getByText("2026년 11월")).toBeTruthy();
    expect((screen.getByRole("button", { name: "이전 달" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
