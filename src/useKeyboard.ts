import { useEffect, useState } from "react";

// 모바일 소프트 키보드가 열렸는지 알려 줘요. 키보드 높이를 고정값으로 가정하지 않고, 실제로 줄어든 화면 높이로 판단해요.
// - iOS Safari: 레이아웃 뷰포트는 그대로고 visualViewport만 줄어요.
// - Android Chrome(interactive-widget=resizes-content): 레이아웃 뷰포트(innerHeight)도 같이 줄어서,
//   "처음 높이"를 기준으로 비교해야 해요(visualViewport.height < innerHeight 비교만으로는 열린 걸 못 알아봐요).
// 주소창이 접히고 펴지는 정도(약 60~100px)는 키보드로 보지 않도록, 글자 입력 칸에 포커스가 있을 때만 열린 것으로 봐요.
const TEXT_TYPES = /^(text|search|email|url|tel|password|number)$/;
export const isTextField = (element: Element | null) =>
  !!element && (element.tagName === "TEXTAREA" || (element.tagName === "INPUT" && TEXT_TYPES.test((element as HTMLInputElement).type)));

export const KEYBOARD_MIN_SHRINK = 150;

export function useKeyboard(enabled: boolean) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) { setOpen(false); return; }
    let baseline = Math.max(window.innerHeight, viewport.height);
    let width = window.innerWidth;
    const update = () => {
      if (window.innerWidth !== width) { width = window.innerWidth; baseline = Math.max(window.innerHeight, viewport.height); } // 화면 회전
      if (!isTextField(document.activeElement)) baseline = Math.max(baseline, window.innerHeight, viewport.height);
      document.documentElement.style.setProperty("--nodi-vvh", `${Math.round(viewport.height)}px`);
      setOpen(isTextField(document.activeElement) && baseline - viewport.height > KEYBOARD_MIN_SHRINK);
    };
    const afterBlur = () => window.setTimeout(update, 60); // 포커스가 다른 입력칸으로 옮겨 가는 사이에 깜빡이지 않게
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", afterBlur);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", afterBlur);
      document.documentElement.style.removeProperty("--nodi-vvh");
    };
  }, [enabled]);
  return open;
}
