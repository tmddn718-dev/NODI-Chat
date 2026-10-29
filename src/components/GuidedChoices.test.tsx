// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getGuidedStep } from "../guided";
import type { MeetingDraft } from "../types";
import { GuidedChoices } from "./GuidedChoices";

afterEach(cleanup);
const base = { version: 1 } as MeetingDraft;

describe("GuidedChoices direct input", () => {
  it("hands off to the chat composer instead of opening an in-card field", () => {
    const onSelect = vi.fn();
    const onDirectInput = vi.fn();
    const step = getGuidedStep(base, "ko")!;
    render(<GuidedChoices step={step} onSelect={onSelect} onDirectInput={onDirectInput} />);
    fireEvent.click(screen.getByRole("button", { name: "직접 입력할게요" }));
    expect(onDirectInput).toHaveBeenCalledWith(step.inputPlaceholder);
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
