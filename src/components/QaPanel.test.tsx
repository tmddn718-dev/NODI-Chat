// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QaPanel, browserUiState, detectOs } from "./QaPanel";

beforeEach(() => { localStorage.clear(); window.history.replaceState({}, "", "/"); });
afterEach(() => { cleanup(); localStorage.clear(); window.history.replaceState({}, "", "/"); });

describe("QaPanel", () => {
  it("renders nothing for ordinary users (no ?qa=1, nothing stored)", () => {
    const { container } = render(<QaPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("shows a collapsed QA pill after ?qa=1, opens the diagnostics, and ?qa=0 turns it off again", () => {
    window.history.replaceState({}, "", "/?qa=1");
    const { unmount } = render(<QaPanel />);
    fireEvent.click(screen.getByRole("button", { name: "QA" }));
    expect(screen.getByLabelText("QA 진단 정보")).toBeTruthy();
    expect(screen.getByText("svh / lvh / dvh")).toBeTruthy();
    expect(screen.getByText("키보드 열림")).toBeTruthy();
    unmount();
    window.history.replaceState({}, "", "/?qa=0");
    const off = render(<QaPanel />);
    expect(off.container.firstChild).toBeNull();
  });

  it("separates measured values from estimates", () => {
    window.history.replaceState({}, "", "/?qa=1");
    render(<QaPanel />);
    fireEvent.click(screen.getByRole("button", { name: "QA" }));
    expect(screen.getAllByText("추정").length).toBeGreaterThan(0);
    expect(screen.getAllByText("측정").length).toBeGreaterThan(0);
  });
});

describe("browser toolbar state from viewport units", () => {
  it("tells expanded, collapsed and in-between apart (and admits when it cannot)", () => {
    expect(browserUiState([664, 750, 664])).toBe("펴짐(주소창·툴바 표시)");
    expect(browserUiState([664, 750, 750])).toBe("접힘");
    expect(browserUiState([664, 750, 710])).toBe("전환 중");
    expect(browserUiState([800, 800, 800])).toBe("구분 안 됨(svh=lvh)");
  });
  it("guesses the OS from the user agent", () => {
    expect(detectOs("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe("iOS");
    expect(detectOs("Mozilla/5.0 (Linux; Android 14; Pixel 8)")).toBe("Android");
    expect(detectOs("Mozilla/5.0 (X11; Linux x86_64)")).toBe("기타");
  });
});
