// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InvitedMeetings } from "./InvitedMeetings";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("InvitedMeetings", () => {
  it("lists invitations by status and moves an invitation to 응답 완료 after answering", () => {
    render(<InvitedMeetings onBack={() => undefined} />);
    expect(screen.getByText("분기 로드맵 리뷰")).toBeTruthy();
    expect(screen.queryByText("주간 프로덕트 싱크")).toBeNull(); // 확정 탭에만 있어요
    fireEvent.click(screen.getByText("분기 로드맵 리뷰"));
    const submit = screen.getByRole("button", { name: "응답 제출" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true); // 아무것도 고르지 않으면 제출할 수 없어요
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    expect(screen.getByText("분기 로드맵 리뷰")).toBeTruthy(); // 응답 완료 탭으로 이동
    expect(screen.getByRole("tab", { name: /응답 완료/ }).getAttribute("aria-selected")).toBe("true");
    expect(JSON.parse(localStorage.getItem("nodi_invited_answers_v1") ?? "{}")["inv-roadmap"].picks).toHaveLength(1);
  });

  it("shows the confirmed meeting read-only", () => {
    render(<InvitedMeetings onBack={() => undefined} />);
    fireEvent.click(screen.getByRole("tab", { name: /확정/ }));
    fireEvent.click(screen.getByText("주간 프로덕트 싱크"));
    expect(screen.getByText("확정된 회의예요")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "응답 제출" })).toBeNull();
  });
});
