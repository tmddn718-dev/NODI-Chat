// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGuidedStep } from "../guided";
import type { MeetingDraft } from "../types";
import { GuidedChoices } from "./GuidedChoices";

afterEach(cleanup);
const base = { version: 1 } as MeetingDraft;

describe("GuidedChoices direct input", () => {
  it("sends a typed meeting title through the same path as a suggested choice", () => {
    const onSelect = vi.fn();
    render(<GuidedChoices step={getGuidedStep(base, "ko")!} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "직접 입력할게요" }));
    expect((screen.getByRole("button", { name: "확인" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("회의 종류 직접 입력"), { target: { value: "신규 서비스 출시 준비" } });
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ patch: { title: "신규 서비스 출시 준비" } }));
  });

  it("accepts only 5–480 minutes for the duration", () => {
    const onSelect = vi.fn();
    const meeting = { ...base, title: "킥오프", purpose: "공유" } as MeetingDraft;
    render(<GuidedChoices step={getGuidedStep(meeting, "ko")!} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "직접 입력할게요" }));
    const input = screen.getByLabelText("회의 시간 직접 입력");
    fireEvent.change(input, { target: { value: "3" } });
    expect((screen.getByRole("button", { name: "확인" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ patch: { durationMinutes: 50 } }));
  });
});
