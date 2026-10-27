import { CalendarCheck, Check, UsersThree, X } from "@phosphor-icons/react";
import type { Candidate, MeetingDraft } from "../types";

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
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
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <button className="dialog-close icon-button" onClick={onClose} aria-label="확인 창 닫기"><X /></button>
        <span className="dialog-icon"><CalendarCheck weight="duotone" /></span>
        <h2 id="confirm-title">이 시간으로 정할까요?</h2>
        <p>정하기 전에 한 번 확인해 주세요. 데모에서는 실제 초대나 캘린더에 반영되지 않아요.</p>
        <dl className="confirm-list">
          <div><dt>제목</dt><dd>{meeting.title}</dd></div>
          <div><dt>일시</dt><dd>{formatDate(candidate.start)}</dd></div>
          <div><dt>참석자</dt><dd>{meeting.attendees?.join(", ")}</dd></div>
          <div><dt>꼭 참석</dt><dd className={candidate.requiredAvailable ? "good" : "warn"}><Check weight="bold" /> {candidate.requiredAvailable ? "모두 참석할 수 있어요" : "시간이 맞지 않아요"}</dd></div>
          <div><dt>초대 전송</dt><dd><UsersThree /> 데모에서는 전송하지 않아요</dd></div>
          <div><dt>캘린더 반영</dt><dd>시간을 정해도 실제 캘린더에는 반영하지 않아요</dd></div>
        </dl>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="ghost-button" onClick={onClose} disabled={loading}>다시 볼게요</button>
          {error ? <button className="primary-button" onClick={onRetry}>새 시간 다시 찾기</button> : <button className="primary-button" onClick={onConfirm} disabled={loading || !candidate.requiredAvailable}>{loading ? "한 번 더 확인하고 있어요..." : "이 시간으로 정하기"}</button>}
        </div>
      </section>
    </div>
  );
}
