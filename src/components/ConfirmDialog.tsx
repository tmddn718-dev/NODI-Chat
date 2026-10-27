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
}: {
  meeting: MeetingDraft;
  candidate: Candidate;
  loading: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <button className="dialog-close icon-button" onClick={onClose} aria-label="확인 창 닫기"><X /></button>
        <span className="dialog-icon"><CalendarCheck weight="duotone" /></span>
        <h2 id="confirm-title">이 일정으로 확정할까요?</h2>
        <p>아래 내용을 확인해 주세요. 현재는 데모 모드로 실제 초대가 전송되지 않습니다.</p>
        <dl className="confirm-list">
          <div><dt>제목</dt><dd>{meeting.title}</dd></div>
          <div><dt>일시</dt><dd>{formatDate(candidate.start)}</dd></div>
          <div><dt>참석자</dt><dd>{meeting.attendees?.join(", ")}</dd></div>
          <div><dt>필수 참석자</dt><dd className={candidate.requiredAvailable ? "good" : "warn"}><Check weight="bold" /> {candidate.requiredAvailable ? "모두 참석 가능" : "확인 필요"}</dd></div>
          <div><dt>초대 전송</dt><dd><UsersThree /> 데모 모드에서는 전송하지 않음</dd></div>
        </dl>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="ghost-button" onClick={onClose} disabled={loading}>돌아가기</button>
          <button className="primary-button" onClick={onConfirm} disabled={loading || !candidate.requiredAvailable}>{loading ? "일정 재확인 중..." : "데모 회의 확정"}</button>
        </div>
      </section>
    </div>
  );
}
