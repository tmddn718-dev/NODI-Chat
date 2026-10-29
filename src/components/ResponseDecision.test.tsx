// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RoundSummary } from "../types";
import { ResponseDecision } from "./ResponseDecision";

afterEach(cleanup);

const person = (attendee: string, responded: boolean) => ({ attendee, urlToken: attendee, responded, delivery: "sent" as const });
const round = (over: Partial<RoundSummary> = {}, requiredAvailable = true) => ({
  token: "t", version: 1, deadlineAt: new Date(Date.now() + 3_600_000).toISOString(), phase: "collecting", responded: 1, total: 2, reminderCount: 0,
  invitedAt: new Date().toISOString(), updatedAt: "", participants: [person("가", true), person("나", false)],
  rows: [{ rank: 1, accepted: 1, declined: 0, tentative: 0, noResponse: 1, reason: "", people: { accepted: ["가"], declined: [], tentative: [], noResponse: ["나"] }, candidate: { id: "c", requiredAvailable, start: "2026-11-03T05:00:00.000Z" } }],
  ...over,
}) as unknown as RoundSummary;
const setup = (r: RoundSummary) => {
  const fns = { onRemind: vi.fn(), onProceed: vi.fn(), onRefresh: vi.fn(), onExtend: vi.fn() };
  render(<ResponseDecision round={r} busy={false} {...fns} />);
  return fns;
};

describe("ResponseDecision", () => {
  it("lets the organizer pick wait or proceed when someone has not answered", () => {
    const fns = setup(round());
    expect(screen.getByText("어떻게 진행할까요?")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /응답 기다리기/ }));
    fireEvent.click(screen.getByRole("button", { name: "미응답 1명에게 재알림 보내기" }));
    expect(fns.onRemind).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "+3시간" }));
    expect(fns.onExtend).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "직접 입력" }));
    const when = new Date(Date.now() + 5 * 86_400_000 + 9 * 3_600_000).toISOString().slice(0, 16);
    fireEvent.change(screen.getByLabelText(/새 응답 마감/), { target: { value: when } });
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    expect(fns.onExtend).toHaveBeenCalledTimes(2);
    expect(fns.onExtend.mock.calls[1][0]).toBe(new Date(`${when}:00+09:00`).toISOString());
    fireEvent.click(screen.getByRole("radio", { name: /현재 조건으로 확정 검토/ }));
    fireEvent.click(screen.getByRole("button", { name: "1순위 시간으로 확정 검토하기" }));
    expect(fns.onProceed).toHaveBeenCalledTimes(1);
  });

  it("holds confirmation and offers a refresh when no candidate fits the required people", () => {
    const fns = setup(round({}, false));
    expect(screen.getByText("꼭 참석할 사람의 시간이 맞는 후보가 없어요")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다른 후보 확인하기" }));
    expect(fns.onRefresh).toHaveBeenCalled();
  });

  it("shows no decision card once everyone answered", () => {
    setup(round({ responded: 2, participants: [person("가", true), person("나", true)] }));
    expect(screen.getByText("모두 응답했어요")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("shows the currently most likely time with each person's response", () => {
    setup(round());
    expect(screen.getByText("현재 가장 유력한 시간")).toBeTruthy();
    expect(screen.getByText("참석 가능")).toBeTruthy();
    expect(screen.getByText("응답 대기")).toBeTruthy();
  });

  it("offers editing the required attendees when no candidate fits", () => {
    const onEditRequired = vi.fn();
    render(<ResponseDecision round={round({}, false)} busy={false} onRemind={vi.fn()} onProceed={vi.fn()} onRefresh={vi.fn()} onEditRequired={onEditRequired} />);
    fireEvent.click(screen.getByRole("button", { name: "필수 참석자 조건 수정하기" }));
    expect(onEditRequired).toHaveBeenCalled();
  });
});
