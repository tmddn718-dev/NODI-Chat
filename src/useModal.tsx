import { useEffect, useRef } from "react";

let counter = 0;
const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 시트·다이얼로그가 열려 있는 동안의 공통 동작: 배경 스크롤 잠금, Esc로 닫기, 포커스를 안으로 옮기고 닫으면 원래 요소로 복원,
 * 브라우저 뒤로 가기(iOS 스와이프·Android 뒤로)가 사이트를 벗어나지 않고 시트만 닫게 해요.
 * 시트가 열릴 때만 렌더되는 곳에 `<ModalBehavior onClose={...} />`를 넣어 쓰세요.
 */
export function useModal(onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = `m${++counter}`;
    let pushed = false;
    let popped = false;
    // 개발 모드(StrictMode)의 즉시 정리와 부딪치지 않도록 한 틱 뒤에 기록을 남겨요.
    const pushTimer = window.setTimeout(() => {
      if (typeof window === "undefined") return; // 테스트 환경이 먼저 정리된 경우
      try {
        const base = (history.state ?? {}) as Record<string, unknown>;
        history.pushState({ ...base, nodiModal: id }, "");
        pushed = true;
      } catch { /* history를 못 쓰면 뒤로 가기 연동만 빠져요 */ }
    }, 0);
    const onPop = () => { if (pushed && (history.state as { nodiModal?: string } | null)?.nodiModal !== id) { popped = true; closeRef.current(); } };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeRef.current(); };
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey);
    const focusTimer = window.requestAnimationFrame(() => {
      if (typeof document === "undefined") return;
      const dialogs = document.querySelectorAll<HTMLElement>('[aria-modal="true"]');
      const dialog = dialogs[dialogs.length - 1];
      if (dialog && !dialog.contains(document.activeElement)) (dialog.querySelector<HTMLElement>(FOCUSABLE) ?? (dialog.setAttribute("tabindex", "-1"), dialog)).focus({ preventScroll: true });
    });
    return () => {
      window.clearTimeout(pushTimer);
      window.cancelAnimationFrame(focusTimer);
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      if (pushed && !popped && (history.state as { nodiModal?: string } | null)?.nodiModal === id) history.back();
      // 글자 입력칸으로는 되돌리지 않아요: 시트를 닫았을 뿐인데 모바일 키보드가 올라오면 화면이 흔들려요.
      const isTyping = opener instanceof HTMLTextAreaElement || (opener instanceof HTMLInputElement && !/^(button|checkbox|radio|submit)$/.test(opener.type)) || !!opener?.isContentEditable;
      if (opener?.isConnected && !isTyping) opener.focus({ preventScroll: true });
    };
  }, []);
}

export function ModalBehavior({ onClose }: { onClose: () => void }) {
  useModal(onClose);
  return null;
}
