import { CalendarCheck, PencilSimple, Trash, Warning } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import type { MeetingEvent } from "../types";

export function MeetingManager({
  event,
  onUpdate,
  onCancel,
  onNew,
}: {
  event: MeetingEvent;
  onUpdate: (title: string) => Promise<void>;
  onCancel: () => Promise<void>;
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
      setError(reason instanceof Error ? reason.message : "수정하지 못했습니다.");
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
      setError(reason instanceof Error ? reason.message : "취소하지 못했습니다.");
      setLoading(false);
    }
  }

  if (event.status === "cancelled") {
    return (
      <main className="result-view">
        <section className="result-card cancelled">
          <span className="result-icon"><Warning weight="duotone" /></span>
          <p className="overline">DEMO CALENDAR</p>
          <h1>회의가 취소되었습니다</h1>
          <p>실제 캘린더나 참석자 초대에는 영향을 주지 않았습니다.</p>
          <button className="primary-button" onClick={onNew}>새 회의 만들기</button>
        </section>
      </main>
    );
  }

  return (
    <main className="result-view">
      <section className="result-card">
        <span className="result-icon"><CalendarCheck weight="duotone" /></span>
        <span className="demo-badge">데모 확정</span>
        <h1>회의 일정을 만들었습니다</h1>
        <p>시뮬레이션이 완료되었습니다. 실제 캘린더 이벤트나 초대는 생성되지 않았습니다.</p>
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
        {error && <p className="dialog-error" role="alert">{error}</p>}
        {!editing && (
          <div className="manage-actions">
            <button className="secondary-button" onClick={() => setEditing(true)}><PencilSimple /> 제목 변경</button>
            <button className="danger-button" onClick={cancel} disabled={loading}><Trash /> {loading ? "취소 중..." : "회의 취소"}</button>
          </div>
        )}
        <button className="text-link standalone-link" onClick={onNew}>다른 회의 만들기</button>
      </section>
    </main>
  );
}
