import { Calendar, CircleCheck, TriangleAlert } from "lucide-react";
import type { MeetingEvent } from "../types";
import { Brand } from "./Brand";

const formatDate = (value: string) => new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

export function MeetingsList({
  events,
  onSelect,
  onBack,
  onNew,
}: {
  events: MeetingEvent[];
  onSelect: (event: MeetingEvent) => void;
  onBack: () => void;
  onNew: () => void;
}) {
  const groups = [
    { title: "동기화 실패", items: events.filter((event) => event.status === "confirmed" && event.calendarSyncStatus === "failed") },
    { title: "확정됨", items: events.filter((event) => event.status === "confirmed" && event.calendarSyncStatus !== "failed") },
    { title: "취소됨", items: events.filter((event) => event.status === "cancelled") },
  ];
  return (
    <main id="main-content" className="meetings-view">
      <header className="meetings-topbar">
        <Brand />
        <button className="ghost-button" onClick={onBack}>회의 잡기로 돌아가기</button>
      </header>
      <section className="meetings-content" aria-labelledby="meetings-title">
        <div className="meetings-heading">
          <div><p className="overline">내 회의</p><h1 id="meetings-title">만든 회의</h1><p>시간과 캘린더 반영 상태를 한눈에 볼 수 있어요.</p></div>
          {events.length > 0 && <button className="primary-button" onClick={onNew}>새 회의 만들기</button>}
        </div>
        {events.length ? groups.map((group) => group.items.length > 0 && (
          <div key={group.title} className="meetings-group">
            <h2 className="meetings-group-title">{group.title} <span>{group.items.length}</span></h2>
            <div className="meetings-list">
              {group.items.map((event) => (
                <button className="meeting-list-row" key={event.id} onClick={() => onSelect(event)}>
                  <span className="meeting-list-icon"><Calendar /></span>
                  <span className="meeting-list-copy"><strong>{event.meeting.title}</strong><small>{formatDate(event.candidate.start)} · {event.meeting.attendees?.length ?? 0}명</small></span>
                  <span className={`status-badge ${event.status === "confirmed" ? "status-success" : "status-warning"}`}>
                    {event.status === "confirmed" ? <CircleCheck /> : <TriangleAlert />}
                    {event.status === "confirmed" ? "시간 정함" : "취소했어요"}
                  </span>
                  <span className={`status-badge ${event.calendarSyncStatus === "synced" ? "status-success" : event.calendarSyncStatus === "failed" ? "status-error" : "status-neutral"}`}>{event.calendarSyncStatus === "synced" ? "캘린더 반영" : event.calendarSyncStatus === "failed" ? "동기화 실패" : "캘린더 미반영"}</span>
                </button>
              ))}
            </div>
          </div>
        )) : (
          <div className="meetings-empty">
            <Calendar />
            <h2>아직 만든 회의가 없어요</h2>
            <p>참석자를 선택하면 NODI가 캘린더와 응답을 비교해 가장 잘 맞는 시간을 찾아드려요.</p>
            <button className="primary-button" onClick={onNew}>첫 회의 만들기</button>
          </div>
        )}
      </section>
    </main>
  );
}
