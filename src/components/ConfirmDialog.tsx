import { Check, TriangleAlert, Users, X } from "lucide-react";
import type { Candidate, MeetingDraft } from "../types";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ConfirmDialog({
  meeting,
  candidate,
  loading,
  error,
  onClose,
  onConfirm,
  onRetry,
}: {
  meeting: MeetingDraft;
  candidate: Candidate;
  loading: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
  onRetry: () => void;
}) {
  const required = meeting.requiredAttendees ?? [];
  const optional = (meeting.attendees ?? []).filter((name) => !required.includes(name));
  const start = formatDate(candidate.start);
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog cd" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <header className="cd-head">
          <span className="cd-badge">회의 확정</span>
          <button className="dialog-close icon-button" onClick={onClose} aria-label="확인 창 닫기"><X /></button>
        </header>
        <h2 id="confirm-title">회의를 확정할까요?</h2>
        <p className="cd-sub">정하기 전에 한 번 확인해 주세요. 정하는 순간 최신 일정을 다시 확인해요.</p>

        <div className="cd-section">
          <div className="cd-title"><strong>{meeting.title}</strong>{meeting.purpose && <span>{meeting.purpose}</span>}</div>
          <dl className="cd-grid">
            <div><dt>일시</dt><dd>{start}</dd></div>
            <div><dt>시간대</dt><dd>{meeting.timezone ?? "Asia/Seoul"}</dd></div>
          </dl>
        </div>

        <div className="cd-section">
          <div className="cd-people">
            <div><strong>필수 참석자</strong><span>{required.length ? required.join(", ") : "없음"}</span></div>
            <em>{required.length}명</em>
          </div>
          <div className="cd-people">
            <div><strong>참여하면 좋은 사람</strong><span>{optional.length ? optional.join(", ") : "없음"}</span></div>
            <em>{optional.length}명</em>
          </div>
          <p className={`cd-status ${candidate.requiredAvailable ? "good" : "warn"}`}><Check /> {candidate.requiredAvailable ? "꼭 참석할 사람 모두 가능해요" : "꼭 참석할 사람의 시간이 맞지 않아요"}</p>
        </div>

        {candidate.unknownCount > 0 && (
          <div className="confirm-tip" role="note">
            <strong><TriangleAlert /> 아직 응답하지 않은 사람이 {candidate.unknownCount}명 있어요</strong>
            <p>수락한 것으로 보지 않아요. 일정이 겹치면 정하지 않고 다른 시간을 안내해요.</p>
          </div>
        )}
        <p className="cd-note"><Users /> 데모에서는 초대를 보내거나 실제 캘린더에 반영하지 않아요.</p>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onClose} disabled={loading}>다시 조율하기</button>
          {error ? <button className="primary-button" onClick={onRetry}>새 시간 다시 찾기</button> : <button className="primary-button" onClick={onConfirm} disabled={loading || !candidate.requiredAvailable}>{loading ? "최신 일정을 확인하고 있어요..." : "회의 확정하기"}</button>}
        </div>
      </section>
    </div>
  );
}
