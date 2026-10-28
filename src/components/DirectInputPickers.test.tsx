// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DateRangePicker } from "./DateRangePicker";
import { RequiredAttendeePicker } from "./RequiredAttendeePicker";

afterEach(cleanup);

describe("DateRangePicker direct input", () => {
  it("applies typed dates to the calendar summary and rejects ranges over 31 days", () => {
    const onConfirm = vi.fn();
    render(<DateRangePicker language="ko" today="2026-10-28" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "직접 입력할게요" }));
    const [start, end] = [screen.getByLabelText("시작일"), screen.getByLabelText("종료일")];
    fireEvent.change(start, { target: { value: "2026-10-30" } });
    fireEvent.change(end, { target: { value: "2026-12-30" } });
    expect(screen.getByRole("alert").textContent).toContain("31일");
    expect((screen.getByRole("button", { name: "적용" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(end, { target: { value: "2026-11-02" } });
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    fireEvent.click(screen.getByRole("button", { name: "이 날짜로 찾기" }));
    expect(onConfirm).toHaveBeenCalledWith("2026-10-30", "2026-11-02");
  });
});

describe("RequiredAttendeePicker direct input", () => {
  it("matches typed names (even partial) and flags names that are not attendees", () => {
    const onConfirm = vi.fn();
    render(<RequiredAttendeePicker attendees={["김민지", "박준호", "Alex Morgan"]} language="ko" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole("button", { name: "직접 알려주기" }));
    const input = screen.getByLabelText("꼭 참석할 사람 직접 입력");
    fireEvent.change(input, { target: { value: "민지, 최유진" } });
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    expect(screen.getByRole("alert").textContent).toContain("최유진");
    fireEvent.change(input, { target: { value: "민지, alex" } });
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    fireEvent.click(screen.getByRole("button", { name: "이대로 계속" }));
    expect(onConfirm).toHaveBeenCalledWith(["김민지", "Alex Morgan"]);
  });
});
