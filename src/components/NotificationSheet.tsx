import { Bell, CalendarCheck, Clock, Mail, X } from "lucide-react";
import type { NodiNotification } from "../notifications";

const ICON = { invite: Mail, round: Clock, confirmed: CalendarCheck } as const;

export function NotificationSheet({ items, readIds, onClose, onOpen, onReadAll }: {
  items: NodiNotification[];
  readIds: string[];
  onClose: () => void;
  onOpen: (item: NodiNotification) => void;
  onReadAll: () => void;
}) {
  const unread = items.filter((item) => !readIds.includes(item.id)).length;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()} onKeyDown={(event) => event.key === "Escape" && onClose()}>
      <section className="dialog notif-sheet" role="dialog" aria-modal="true" aria-labelledby="notif-title">
        <header className="notif-head">
          <h2 id="notif-title">알림</h2>
          {unread > 0 && <button type="button" className="text-link" onClick={onReadAll}>모두 읽음</button>}
          <button type="button" className="icon-button" onClick={onClose} aria-label="알림 닫기" autoFocus><X /></button>
        </header>
        {items.length === 0 ? (
          <div className="notif-empty" role="status"><Bell aria-hidden="true" /><strong>새 알림이 없어요</strong><p>초대받은 회의나 응답 현황이 바뀌면 여기에 보여요.</p></div>
        ) : (
          <ul className="notif-list">
            {items.map((item) => {
              const Icon = ICON[item.kind];
              const isUnread = !readIds.includes(item.id);
              return (
                <li key={item.id}>
                  <button type="button" className={`notif-item ${isUnread ? "unread" : ""}`} onClick={() => onOpen(item)}>
                    <span className="notif-icon" aria-hidden="true"><Icon /></span>
                    <span className="notif-copy"><strong>{item.title}</strong><small>{item.body}</small></span>
                    {isUnread && <span className="notif-dot" role="img" aria-label="안 읽음" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="notif-note">체험용 데모예요. 실제 메일이나 푸시 알림은 보내지 않아요.</p>
      </section>
    </div>
  );
}
