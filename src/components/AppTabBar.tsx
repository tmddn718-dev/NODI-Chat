import { CalendarDays, Inbox, MessageSquarePlus } from "lucide-react";

export type AppTab = "chat" | "meetings" | "invited";

// 모바일 하단 탭 3개. 데스크톱에서는 CSS로 숨기고 좌측 내비게이션을 써요.
export function AppTabBar({ active, onNavigate, pending = 0 }: { active: AppTab; onNavigate: (tab: AppTab) => void; pending?: number }) {
  const items: Array<{ id: AppTab; label: string; Icon: typeof Inbox }> = [
    { id: "chat", label: "회의 잡기", Icon: MessageSquarePlus },
    { id: "meetings", label: "내 회의", Icon: CalendarDays },
    { id: "invited", label: "받은 요청", Icon: Inbox },
  ];
  return (
    <nav className="app-tabbar" aria-label="주요 메뉴">
      {items.map(({ id, label, Icon }) => (
        <button key={id} type="button" className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} onClick={() => active !== id && onNavigate(id)}>
          <span className="tab-ico"><Icon aria-hidden="true" />{id === "invited" && pending > 0 && <i className="tab-badge" aria-hidden="true">{pending > 9 ? "9+" : pending}</i>}</span>
          <span>{label}</span>
          {id === "invited" && pending > 0 && <span className="sr-only">응답이 필요한 요청 {pending}건</span>}
        </button>
      ))}
    </nav>
  );
}
