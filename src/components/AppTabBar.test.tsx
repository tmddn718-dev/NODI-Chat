// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./AccountMenu";
import { AppTabBar } from "./AppTabBar";

afterEach(cleanup);

describe("AppTabBar", () => {
  it("shows three tabs, marks the active one and reports pending requests", () => {
    const go = vi.fn();
    render(<AppTabBar active="meetings" pending={2} onNavigate={go} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: /내 회의/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("응답이 필요한 요청 2건")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /받은 요청/ }));
    expect(go).toHaveBeenCalledWith("invited");
    fireEvent.click(screen.getByRole("button", { name: /내 회의/ }));
    expect(go).toHaveBeenCalledTimes(1); // 현재 탭은 다시 눌러도 이동하지 않아요
  });
});

describe("AccountMenu", () => {
  it("opens settings and calendar connection from the account menu", () => {
    const settings = vi.fn(); const calendars = vi.fn();
    render(<AccountMenu onSettings={settings} onCalendars={calendars} />);
    fireEvent.click(screen.getByRole("button", { name: "계정 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /캘린더 연결/ }));
    expect(calendars).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "계정 메뉴" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /설정/ }));
    expect(settings).toHaveBeenCalled();
  });
});
