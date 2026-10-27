// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AvailabilityEditor } from "./AvailabilityEditor";

afterEach(cleanup);

describe("AvailabilityEditor", () => {
  it("adds an editable time range when an attendee responds as available", () => {
    const onChange = vi.fn();
    render(
      <AvailabilityEditor
        responses={[{ attendee: "김민지", status: "no_response" }]}
        dateStart="2026-10-28"
        dateEnd="2026-10-30"
        loading={false}
        onChange={onChange}
        onSubmit={() => undefined}
      />,
    );
    fireEvent.change(screen.getByLabelText("김민지 참석 상태"), { target: { value: "available" } });
    expect(onChange).toHaveBeenCalledWith([{
      attendee: "김민지",
      status: "available",
      start: "2026-10-28T09:00:00+09:00",
      end: "2026-10-30T18:00:00+09:00",
    }]);
  });

  it("submits even when some attendees have not responded so they stay unknown", () => {
    const onSubmit = vi.fn();
    render(
      <AvailabilityEditor
        responses={[{ attendee: "박준호", status: "no_response" }]}
        dateStart="2026-10-28"
        dateEnd="2026-10-28"
        loading={false}
        onChange={() => undefined}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "추천 시간 보기" }));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.getByText("0/1명 응답")).toBeTruthy();
  });

  it("lets the organizer choose the attendee invitation flow", () => {
    const onCreateInvite = vi.fn();
    render(
      <AvailabilityEditor
        responses={[{ attendee: "김민지", status: "no_response" }]}
        dateStart="2026-10-28"
        dateEnd="2026-10-30"
        loading={false}
        onChange={() => undefined}
        onSubmit={() => undefined}
        onCreateInvite={onCreateInvite}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /참석자가 답해요/ }));
    fireEvent.click(screen.getByRole("button", { name: "초대장 만들기" }));
    expect(onCreateInvite).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "먼저 초대장을 만들어 주세요" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows invitation responses as read-only while automatic updates are active", () => {
    render(
      <AvailabilityEditor
        responses={[
          { attendee: "김민지", status: "available", start: "2026-10-28T09:00:00+09:00", end: "2026-10-28T12:00:00+09:00" },
          { attendee: "박준호", status: "no_response" },
        ]}
        dateStart="2026-10-28"
        dateEnd="2026-10-30"
        loading={false}
        onChange={() => undefined}
        onSubmit={() => undefined}
        inviteLinks={[
          { attendee: "김민지", urlToken: "a".repeat(48) },
          { attendee: "박준호", urlToken: "b".repeat(48) },
        ]}
        lastInviteSyncAt="2026-10-27T12:34:56.000Z"
        onCreateInvite={() => undefined}
        onRefreshResponses={() => undefined}
      />,
    );

    expect(screen.getByText("새 답변을 자동으로 확인해요")).toBeTruthy();
    expect(screen.getByText("1/2명 응답")).toBeTruthy();
    expect((screen.getByLabelText("김민지 참석 상태") as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getAllByRole("button", { name: "초대 보내기" })).toHaveLength(2);
  });
});
