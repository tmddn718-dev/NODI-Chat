import { Check, LoaderCircle, TriangleAlert, X } from "lucide-react";
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

export type VerifyState = { state: "checking" | "ok" | "failed"; message: string; retryable?: boolean };

export function ConfirmDialog({
  verify,
  onRecheck,
  meeting,
  candidate,
  loading,
  error,
  onClose,
  onConfirm,
  onRetry,
}: {
  verify: VerifyState;
  onRecheck: () => void;
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
  const minutesAgo = Math.max(0, Math.round((Date.now() - Date.parse(candidate.checkedAt)) / 60_000));
  const invitees = (meeting.attendees ?? []).length;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog cd" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <header className="cd-head">
          <span className="cd-badge">회의 확정</span>
          <button className="dialog-close icon-button" onClick={onClose} aria-label="확인 창 닫기"><X /></button>
        </header>
        <h2 id="confirm-title">{verify.state === "failed" ? "이 시간은 확정할 수 없어요" : "이 시간으로 확정할까요?"}</h2>
        <div className={`cd-verify ${verify.state}`} role="status" aria-live="polite">
          {verify.state === "checking" && (
            <>
              <p><LoaderCircle className="spin" aria-hidden="true" /> 최신 일정을 다시 확인하고 있어요</p>
              <ul><li>필수 참석자 일정</li><li>새로 생긴 충돌</li><li>참석자 최신 응답</li><li>회의 조건 버전</li></ul>
            </>
          )}
          {verify.state === "ok" && <p><Check aria-hidden="true" /> {verify.message}</p>}
          {verify.state === "failed" && <p><TriangleAlert aria-hidden="true" /> {verify.message}</p>}
        </div>

        <div className="cd-section">
          <div className="cd-title"><strong>{meeting.title}</strong>{meeting.purpose && <span>{meeting.purpose}</span>}</div>
          <dl className="cd-grid">
            <div><dt>일시</dt><dd>{start}</dd></div>
            <div><dt>시간대</dt><dd>{meeting.timezone ?? "Asia/Seoul"}</dd></div>
            <div><dt>최신 일정</dt><dd>{verify.state === "checking" ? "확인 중" : minutesAgo < 1 ? "방금 확인 완료" : `${minutesAgo}분 전 확인`}</dd></div>
            <div><dt>초대 대상</dt><dd>{invitees}명</dd></div>
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
        </div>

        <div className="cd-groups">
          <section aria-label="확정 가능한 이유">
            <h3>확정 가능한 이유</h3>
            <ul>
              <li className="ok"><Check aria-hidden="true" /><span>{candidate.requiredAvailable ? (required.length ? "필수 참석자 조건 충족" : "필수 조건 없음") : "필수 참석자 조건 확인 필요"}</span></li>
              <li className={verify.state === "ok" ? "ok" : "warn"}>{verify.state === "ok" ? <Check aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}<span>{verify.state === "ok" ? "최신 일정 충돌 재확인 완료" : verify.state === "checking" ? "최신 일정 확인 중" : "최신 일정을 확인하지 못했어요"}</span></li>
            </ul>
          </section>
          <section aria-label="남아 있는 불확실성">
            <h3>남아 있는 불확실성</h3>
            {candidate.unknownCount > 0
              ? <ul><li className="warn"><TriangleAlert aria-hidden="true" /><span>선택 참석자 {candidate.unknownCount}명 응답 대기</span></li><li className="plain"><span>필수 참석자는 아니어서 확정할 수 있지만, 초대 후 참석하지 못할 수 있어요. 응답 대기를 수락으로 보지 않아요.</span></li></ul>
              : <ul><li className="plain"><span>남아 있는 미확인 정보는 없어요.</span></li></ul>}
          </section>
          <section aria-label="확정 이후 처리될 작업">
            <h3>확정 이후 처리될 작업</h3>
            <ul><li className="plain"><span>NODI에 회의 시간이 저장돼요. 캘린더 반영과 실제 초대 발송은 별도 상태로 안내돼요. 데모에서는 이루어지지 않아요.</span></li></ul>
          </section>
        </div>
        {error && <p className="dialog-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onClose} disabled={loading}>다른 시간 보기</button>
          {verify.state === "failed"
            ? <button className="primary-button" onClick={verify.retryable ? onRecheck : onRetry}>{verify.retryable ? "다시 확인하기" : "새로운 추천 보기"}</button>
            : error
              ? <button className="primary-button" onClick={onRetry}>새 시간 다시 찾기</button>
              : <button className="primary-button" onClick={onConfirm} disabled={loading || verify.state !== "ok" || !candidate.requiredAvailable}>{loading ? "캘린더에 회의를 만들고 있어요..." : verify.state === "checking" ? "확인 중..." : "회의 확정하기"}</button>}
        </div>
      </section>
    </div>
  );
}
