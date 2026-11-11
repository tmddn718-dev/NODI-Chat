import { CalendarSync, CircleUserRound, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// 설정과 캘린더 연결은 하단 탭이 아니라 계정 메뉴에서 열어요. 기존 화면·다이얼로그를 그대로 연결해요.
export function AccountMenu({ onSettings, onCalendars }: { onSettings: () => void; onCalendars: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent) { if (event.key === "Escape") { setOpen(false); button.current?.focus(); } return; }
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  const pick = (action: () => void) => () => { setOpen(false); action(); };
  return (
    <div className="account-menu" ref={ref}>
      <button type="button" ref={button} className="icon-button" aria-label="계정 메뉴" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}><CircleUserRound /></button>
      {open && (
        <div className="more-pop" role="menu" aria-label="계정 메뉴">
          <button type="button" role="menuitem" onClick={pick(onSettings)}><Settings2 aria-hidden="true" /> 설정</button>
          <button type="button" role="menuitem" onClick={pick(onCalendars)}><CalendarSync aria-hidden="true" /> 캘린더 연결</button>
        </div>
      )}
    </div>
  );
}
