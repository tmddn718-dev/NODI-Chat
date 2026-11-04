import { useEffect, useState } from "react";
import { useKeyboard } from "../useKeyboard";

// 모바일 브라우저 QA용 진단 패널(주소창·툴바가 있는 상태가 기본 조건). 일반 사용자 화면에는 나오지 않아요.
// 브라우저 UI를 숨겨서 문제를 피하지 않고, 주소창이 펴졌을 때(svh)·접혔을 때(lvh)·지금(dvh)의 높이를 각각 재서 둘 다 확인할 수 있게 해요.
// 켜지는 조건: 개발 서버이거나 빌드에 VITE_ENABLE_QA=1이 있고, 그다음 ?qa=1 주소로 한 번 열거나 로고를 5번 연달아 눌렀을 때.
// 끄기: ?qa=0 또는 로고를 다시 5번. 상태는 이 브라우저에만 저장돼요(서버로 보내지 않아요).
const KEY = "nodi_qa";
const BUILD_ENABLED = import.meta.env.DEV || (import.meta.env as Record<string, string | undefined>).VITE_ENABLE_QA === "1";

const read = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const write = (on: boolean) => { try { on ? localStorage.setItem(KEY, "1") : localStorage.removeItem(KEY); } catch { /* 저장소를 못 쓰면 이번 방문에서만 켜져요 */ } };

export const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const detectOs = (ua = navigator.userAgent) => (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? "iOS" : /Android/.test(ua) ? "Android" : "기타");

// env(safe-area-inset-*)는 JS로 바로 못 읽어서, 숨은 요소의 padding으로 바꿔 읽어요.
function readInsets() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.append(probe);
  const style = getComputedStyle(probe);
  const insets = [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map((value) => Math.round(parseFloat(value) || 0));
  probe.remove();
  return insets as [number, number, number, number];
}

// svh(브라우저 UI가 펴진 최소 높이) · lvh(UI가 접힌 최대 높이) · dvh(지금 높이)를 숨은 요소로 읽어요.
function readViewportUnits() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;width:0";
  const heights = (["100svh", "100lvh", "100dvh"] as const).map((unit) => { probe.style.height = unit; document.body.append(probe); return Math.round(probe.getBoundingClientRect().height); });
  probe.remove();
  return heights as [number, number, number];
}
// 지금 dvh가 svh에 가까우면 주소창이 펴진 상태, lvh에 가까우면 접힌 상태로 추정해요(둘이 같으면 구분할 수 없어요).
export function browserUiState([svh, lvh, dvh]: [number, number, number]) {
  if (lvh - svh < 8) return "구분 안 됨(svh=lvh)";
  if (dvh - svh < 8) return "펴짐(주소창·툴바 표시)";
  if (lvh - dvh < 8) return "접힘";
  return "전환 중";
}

export function QaPanel() {
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const keyboard = useKeyboard(on);

  useEffect(() => {
    if (!BUILD_ENABLED) return;
    const flag = new URLSearchParams(window.location.search).get("qa");
    if (flag === "1") write(true);
    if (flag === "0") write(false);
    setOn(read());
    let taps = 0; let timer = 0;
    const onTap = (event: Event) => {
      if (!(event.target as Element | null)?.closest?.(".brand, .brand-mark, .topbar-left")) return;
      taps += 1; window.clearTimeout(timer); timer = window.setTimeout(() => { taps = 0; }, 1500);
      if (taps >= 5) { taps = 0; const next = !read(); write(next); setOn(next); }
    };
    document.addEventListener("click", onTap, true);
    return () => document.removeEventListener("click", onTap, true);
  }, []);

  useEffect(() => {
    if (!on || !open) return;
    const refresh = () => setTick((value) => value + 1);
    const vv = window.visualViewport;
    const events: Array<[EventTarget | null | undefined, string]> = [[window, "resize"], [window, "orientationchange"], [vv, "resize"], [vv, "scroll"], [document, "focusin"], [document, "focusout"]];
    events.forEach(([target, name]) => target?.addEventListener(name, refresh));
    const interval = window.setInterval(refresh, 1000);
    return () => { events.forEach(([target, name]) => target?.removeEventListener(name, refresh)); window.clearInterval(interval); };
  }, [on, open]);

  if (!BUILD_ENABLED || !on) return null;

  const vv = window.visualViewport;
  const active = document.activeElement;
  const tabbar = document.querySelector<HTMLElement>(".app-tabbar");
  const rows: Array<[string, string, "측정" | "추정"]> = [
    ["실행 환경", isStandalone() ? "Standalone(홈 화면 앱)" : "Browser", "측정"],
    ["OS", detectOs(), "추정"],
    ["innerWidth × innerHeight", `${window.innerWidth} × ${window.innerHeight}`, "측정"],
    ["svh / lvh / dvh", readViewportUnits().join(" / "), "측정"],
    ["브라우저 UI(주소창·툴바)", browserUiState(readViewportUnits()), "추정"],
    ["screen 높이", String(window.screen.height), "측정"],
    ["Visual Viewport 높이 / 위", vv ? `${Math.round(vv.height)} / ${Math.round(vv.offsetTop)}` : "지원 안 함", "측정"],
    ["Visual Viewport 배율", vv ? vv.scale.toFixed(2) : "-", "측정"],
    ["Safe Area 상/우/하/좌", readInsets().join(" / "), "측정"],
    ["포커스", active && active !== document.body ? `${active.tagName.toLowerCase()}${(active as HTMLElement).id ? `#${(active as HTMLElement).id}` : ""}` : "없음", "측정"],
    ["키보드 열림", keyboard ? "열림으로 봄" : "닫힘으로 봄", "추정"],
    ["하단 내비게이션", tabbar ? (getComputedStyle(tabbar).display === "none" ? "숨김" : "표시") : "없음(이 화면)", "측정"],
  ];
  return (
    <div className="qa-panel" data-tick={tick}>
      <button type="button" className="qa-pill" aria-expanded={open} onClick={() => setOpen((value) => !value)}>QA</button>
      {open && (
        <dl className="qa-list" aria-label="QA 진단 정보">
          {rows.map(([label, value, kind]) => <div key={label}><dt>{label}<em>{kind}</em></dt><dd>{value}</dd></div>)}
        </dl>
      )}
    </div>
  );
}
