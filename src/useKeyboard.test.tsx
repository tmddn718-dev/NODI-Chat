// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isComposingEnter } from "./inputProps";
import { useKeyboard } from "./useKeyboard";

class FakeViewport extends EventTarget { height = 800; offsetTop = 0; }
let vv: FakeViewport;
const setSize = (inner: number, visual: number) => {
  Object.defineProperty(window, "innerHeight", { configurable: true, value: inner });
  vv.height = visual;
  act(() => { vv.dispatchEvent(new Event("resize")); });
};
const focus = (tag: "textarea" | "button") => {
  const element = document.createElement(tag);
  document.body.append(element);
  act(() => element.focus());
  return element;
};

beforeEach(() => {
  vv = new FakeViewport();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: vv });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
});
afterEach(() => { cleanup(); document.body.innerHTML = ""; document.documentElement.style.removeProperty("--nodi-vvh"); });

describe("useKeyboard", () => {
  it("opens when a text field has focus and only the visual viewport shrinks (iOS)", () => {
    const { result } = renderHook(() => useKeyboard(true));
    focus("textarea");
    setSize(800, 480);
    expect(result.current).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--nodi-vvh")).toBe("480px");
    setSize(800, 800);
    expect(result.current).toBe(false);
  });

  it("opens when the layout viewport itself shrinks (Android resizes-content) by comparing with the original height", () => {
    const { result } = renderHook(() => useKeyboard(true));
    focus("textarea");
    setSize(500, 500);
    expect(result.current).toBe(true);
    setSize(800, 800);
    expect(result.current).toBe(false);
  });

  it("does not treat a browser address-bar change, or a shrink without a focused field, as a keyboard", () => {
    const { result } = renderHook(() => useKeyboard(true));
    focus("textarea");
    setSize(800, 730); // 주소창 정도의 변화
    expect(result.current).toBe(false);
    document.body.innerHTML = "";
    focus("button");
    setSize(800, 450);
    expect(result.current).toBe(false);
  });

  it("is off when disabled (desktop)", () => {
    const { result } = renderHook(() => useKeyboard(false));
    focus("textarea");
    setSize(800, 400);
    expect(result.current).toBe(false);
  });
});

describe("isComposingEnter", () => {
  it("ignores Enter that confirms a Korean IME composition", () => {
    expect(isComposingEnter({ key: "Enter", nativeEvent: { isComposing: true } })).toBe(true);
    expect(isComposingEnter({ key: "Enter", nativeEvent: { keyCode: 229 } })).toBe(true);
    expect(isComposingEnter({ key: "Enter", nativeEvent: { isComposing: false, keyCode: 13 } })).toBe(false);
    expect(isComposingEnter({ key: "a", nativeEvent: { isComposing: true } })).toBe(false);
  });
});
