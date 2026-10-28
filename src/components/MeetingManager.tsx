import { CalendarCheck, TriangleAlert } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { MeetingEvent } from "../types";

export function MeetingManager({
  event,
  onUpdate,
  onCancel,
  onBack,
  onNew,
}: {
  event: MeetingEvent;
  onUpdate: (title: string) => Promise<void>;
  onCancel: () => Promise<void>;
  onBack: () => void;
  onNew: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.meeting.title ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const date = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(event.candidate.start));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      await onUpdate(title.trim());
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "바꾸지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function cancel() {
    setLoading(true);
    setError("");
    try {
      await onCancel();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "취소하지 못했어요.");
      setLoading(false);
    }
  }

  if (event.status === "cancelled") {
    return (
      <main id="main-content" className="result-view">
        <section className="result-card cancelled">
          <span className="result-icon"><TriangleAlert /></span>
          <p className="overline">데모 캘린더</p>
          <h1>회의를 취소했어요</h1>
          <p>실제 캘린더와 참석자 초대에는 영향을 주지 않았어요.</p>
          <button className="primary-button" onClick={onNew}>새 회의 만들기</button>
          <button className="text-link standalone-link" onClick={onBack}>내 회의로 돌아가기</button>
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" className="result-view">
      <section className="result-card">
        <span className="result-icon"><CalendarCheck /></span>
        <span className="demo-badge">시간을 정했어요 · 데모</span>
        <h1>회의 시간이 정해졌어요</h1>
        <p>데모 안에서만 정했어요. 실제 캘린더와 초대에는 아직 반영하지 않았어요.</p>
        <div className="event-details">
          {editing ? (
            <form onSubmit={save} className="edit-form">
              <label htmlFor="event-title">회의 제목</label>
              <input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div><button className="ghost-button" type="button" onClick={() => setEditing(false)}>취소</button><button className="primary-button" disabled={loading}>저장</button></div>
            </form>
          ) : (
            <><h2>{event.meeting.title}</h2><p>{date}</p><p>{event.meeting.attendees?.join(", ")}</p></>
          )}
        </div>
        <div className="result-statuses" aria-label="회의 처리 상태">
          <span className="status-badge status-success"><CalendarCheck /> 시간 정함</span>
          <span className={`status-badge ${event.calendarSyncStatus === "synced" ? "status-success" : event.calendarSyncStatus === "failed" ? "status-error" : "status-neutral"}`}>{event.calendarSyncStatus === "synced" ? "캘린더 반영" : event.calendarSyncStatus === "failed" ? "동기화 실패" : "캘린더 미반영"}</span>
          <span className="status-badge status-neutral">{event.invitationSent ? "초대 전송" : "초대 미전송"}</span>
          <span className="status-badge status-neutral">준비 사항 없음</span>
        </div>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        {!editing && (
          <div className="manage-actions">
            <button className="secondary-button" onClick={() => setEditing(true)}>제목 바꾸기</button>
            <button className="danger-button" onClick={cancel} disabled={loading}>{loading ? "취소 중..." : "회의 취소"}</button>
          </div>
        )}
        <button className="text-link standalone-link" onClick={onNew}>새 회의 만들기</button>
        <button className="text-link standalone-link" onClick={onBack}>내 회의 목록</button>
      </section>
    </main>
  );
}
