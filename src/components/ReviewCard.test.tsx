// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MeetingDraft } from "../types";
import { ReviewCard } from "./ReviewCard";

afterEach(cleanup);

const full: MeetingDraft = {
  title: "팀 정기 회의", purpose: "진행 상황 공유", durationMinutes: 60,
  attendees: ["김민지", "박준호", "이소라"], requiredAttendees: ["김민지"],
  preferredTime: "afternoon", dateStart: "2026-11-02", dateEnd: "2026-11-06", version: 1,
} as MeetingDraft;

describe("ReviewCard", () => {
  it("counts completed conditions and enables the CTA only when all are set", () => {
    const onProceed = vi.fn();
    render(<ReviewCard meeting={full} onEdit={() => undefined} onProceed={onProceed} />);
    expect(screen.getByText("6/6 완료")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "가능한 시간 찾기" }));
    expect(onProceed).toHaveBeenCalledOnce();
  });

  it("disables the CTA and flags missing items", () => {
    render(<ReviewCard meeting={{ ...full, preferredTime: undefined }} onEdit={() => undefined} onProceed={() => undefined} />);
    expect(screen.getByText("5/6 완료")).toBeTruthy();
    expect((screen.getByRole("button", { name: "가능한 시간 찾기" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText("아직 정하지 않았어요")).toHaveLength(1);
  });
});
