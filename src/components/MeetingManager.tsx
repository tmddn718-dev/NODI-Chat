import { Circle, CircleCheck, TriangleAlert } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { MeetingDraft, MeetingEvent } from "../types";
import { namesLabel } from "../format";

export function MeetingManager({
  event,
  onUpdate,
  onRetryNotify,
  onCancel,
  onBack,
  onNew,
}: {
  event: MeetingEvent;
  onUpdate: (patch: Partial<MeetingDraft>, notify: "now" | "none") => Promise<void>;
  onRetryNotify?: () => Promise<void>;
  onCancel: () => Promise<void>;
  onBack: () => void;
  onNew: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(event.meeting.title ?? "");
  const [purpose, setPurpose] = useState(event.meeting.purpose ?? "");
  const [reviewing, setReviewing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notify, setNotify] = useState<"now" | "none">("now");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const changes = [
    { label: "제목", before: event.meeting.title ?? "", after: title.trim() },
    { label: "목적", before: event.meeting.purpose ?? "", after: purpose.trim() },
  ].filter((item) => item.after && item.before !== item.after);
  const attendees = event.meeting.attendees ?? [];

  // 저장 전에 변경 전후와 영향받는 사람을 보여주고, 알림 방식은 주최자가 골라요.
  function review(e: FormEvent) {
    e.preventDefault();
    if (changes.length) setReviewing(true);
  }

  async function save() {
    setLoading(true);
    setError("");
    try {
      await onUpdate({ title: title.trim() || event.meeting.title, purpose: purpose.trim() || event.meeting.purpose }, notify);
      setReviewing(false);
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "바꾸지 못했어요.");
    } finally {
      setLoading(false);
    }
  }

  async function retry() {
    setLoading(true);
    setError("");
    try { await onRetryNotify?.(); } catch (reason) { setError(reason instanceof Error ? reason.message : "다시 보내지 못했어요."); } finally { setLoading(false); }
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

  const day = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "long" }).format(new Date(event.candidate.start));
  const clock = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  const minutes = Math.round((Date.parse(event.candidate.end) - Date.parse(event.candidate.start)) / 60_000);
  const required = event.meeting.requiredAttendees ?? [];
  const optional = attendees.filter((name) => !required.includes(name));
  const calendar = event.calendarSyncStatus === "synced" ? "캘린더에 반영됨" : event.calendarSyncStatus === "failed" ? "동기화 실패" : "아직 반영 안 됨";
  const sentCount = (event.notifications ?? []).filter((item) => item.version === event.version && item.status === "recorded").length;

  // 토스 결제완료 화면 구조 참고: 성공 아이콘 + 핵심 결과(언제) → 정보 섹션(라벨·값 행) → 처리 상태 → 하단 버튼 두 개. 취소는 눈에 덜 띄게 두고 한 번 더 확인해요.
  return (
    <main id="main-content" className="result-view">
      <section className="result-card done">
        <div className="done-hero">
          <span className="done-check"><CircleCheck aria-hidden="true" /></span>
          <p className="done-eyebrow">NODI에서 회의 시간이 확정됐어요</p>
          <h1>{day}</h1>
          <p className="done-time">{clock(event.candidate.start)} – {clock(event.candidate.end)} <span>· {minutes}분</span></p>
        </div>

        <section className="done-section" aria-labelledby="done-info">
          <div className="done-section-head">
            <h2 id="done-info">회의 정보</h2>
            {!editing && <button className="soft-pill" onClick={() => setEditing(true)}>제목·목적 바꾸기</button>}
          </div>
          {editing ? (
            reviewing ? (
              <section className="change-review" aria-label="변경 내용 확인">
                <h3>변경 내용을 확인해 주세요</h3>
                <ul className="change-list">
                  {changes.map((item) => <li key={item.label}><span>{item.label}</span><strong><s>{item.before || "없음"}</s> → {item.after}</strong></li>)}
                </ul>
                <p className="rd-caption">영향받는 참석자 {attendees.length}명 · 시간은 바뀌지 않아서 기존 응답은 그대로 유효해요.</p>
                <div className="rd-options" role="radiogroup" aria-label="알림 방식">
                  <label className={`rd-option ${notify === "now" ? "on" : ""}`}><input type="radio" name="notify" checked={notify === "now"} onChange={() => setNotify("now")} /><span className="rd-radio" aria-hidden="true" /><span><strong>변경과 동시에 알리기</strong><em>데모에서는 발송함에 기록만 해요. 실제 메일은 나가지 않아요.</em></span></label>
                  <label className={`rd-option ${notify === "none" ? "on" : ""}`}><input type="radio" name="notify" checked={notify === "none"} onChange={() => setNotify("none")} /><span className="rd-radio" aria-hidden="true" /><span><strong>저장만 하고 직접 공유하기</strong><em>참석자에게 알리지 않아요. 직접 전달해야 해요.</em></span></label>
                </div>
                <div className="edit-actions"><button className="ghost-button" type="button" onClick={() => setReviewing(false)}>다시 수정</button><button className="primary-button" type="button" onClick={() => void save()} disabled={loading}>{loading ? "저장 중..." : "변경 저장"}</button></div>
              </section>
            ) : (
              <form onSubmit={review} className="edit-form">
                <label htmlFor="event-title">회의 제목</label>
                <input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                <label htmlFor="event-purpose">회의 목적</label>
                <input id="event-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
                <div><button className="ghost-button" type="button" onClick={() => setEditing(false)}>취소</button><button className="primary-button" disabled={!changes.length}>변경 확인</button></div>
              </form>
            )
          ) : (
            <dl className="done-rows">
              <div><dt>회의</dt><dd>{event.meeting.title}</dd></div>
              {event.meeting.purpose && <div><dt>목적</dt><dd>{event.meeting.purpose}</dd></div>}
              {required.length > 0 && <div><dt>꼭 참석 {required.length}명</dt><dd>{namesLabel(required)}</dd></div>}
              <div><dt>{required.length ? `참여하면 좋은 사람 ${optional.length}명` : `참석자 ${attendees.length}명`}</dt><dd>{namesLabel(required.length ? optional : attendees) || "없음"}</dd></div>
            </dl>
          )}
        </section>

        <section className="done-section" aria-labelledby="done-status">
          <div className="done-section-head"><h2 id="done-status">처리 상태</h2></div>
          <ul className="done-steps">
            <li className="done"><CircleCheck aria-hidden="true" /><span>회의 시간 확정 완료</span></li>
            <li className={event.calendarSyncStatus === "synced" ? "done" : event.calendarSyncStatus === "failed" ? "fail" : ""}>{event.calendarSyncStatus === "synced" ? <CircleCheck aria-hidden="true" /> : event.calendarSyncStatus === "failed" ? <TriangleAlert aria-hidden="true" /> : <Circle aria-hidden="true" />}<span>{calendar === "아직 반영 안 됨" ? "외부 캘린더 반영 전" : calendar}{event.calendarSyncStatus === "not_connected" && <small>데모에서는 지원되지 않아요</small>}</span></li>
            <li className={event.invitationSent ? "done" : ""}>{event.invitationSent ? <CircleCheck aria-hidden="true" /> : <Circle aria-hidden="true" />}<span>{event.invitationSent ? "참석자 초대 발송 완료" : "참석자 초대 발송 전"}{!event.invitationSent && <small>데모에서는 지원되지 않아요</small>}</span></li>
          </ul>
          <p className="done-note">현재 데모 환경에서는 실제 캘린더 반영과 초대 발송이 이루어지지 않아요.</p>
        </section>

        {(event.notifications?.length ?? 0) > 0 && !editing && (
          <section className="done-section" aria-label="변경 알림 상태">
            <div className="done-section-head"><h2>변경 알림</h2><span className="done-count">{sentCount}/{attendees.length}명 기록</span></div>
            <ul className="done-list">
              {event.notifications!.map((item) => (
                <li key={item.attendee}>
                  <span>{item.attendee}</span>
                  <span className={`status-badge ${item.status === "recorded" ? "status-success" : item.status === "failed" ? "status-error" : "status-neutral"}`}>
                    {item.status === "recorded" ? <><CircleCheck /> 발송함에 기록됨 · 데모</> : item.status === "failed" ? <><TriangleAlert /> {item.reason}</> : item.reason}
                  </span>
                </li>
              ))}
            </ul>
            {event.notifications!.some((item) => item.version === event.version && item.status === "failed") && onRetryNotify && <button className="secondary-button" onClick={() => void retry()} disabled={loading}>실패한 사람에게만 다시 보내기</button>}
          </section>
        )}
        {(event.revisions?.length ?? 0) > 0 && !editing && (
          <section className="done-section" aria-label="변경 이력">
            <div className="done-section-head"><h2>변경 이력</h2></div>
            <ul className="done-list">
              {[...event.revisions!].reverse().map((revision) => (
                <li key={revision.version}>
                  <span>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(revision.changedAt))}</span>
                  <span>{revision.changedFields.map((field) => `${field === "title" ? "제목" : field === "purpose" ? "목적" : field}: ${String(revision.before[field] ?? "없음")} → ${String(revision.after[field] ?? "없음")}`).join(", ")}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {error && <p className="dialog-error" role="alert">{error}</p>}
        {!editing && (
          <>
            <div className="done-actions">
              <button className="secondary-button" onClick={onNew}>새 회의 만들기</button>
              <button className="primary-button" onClick={onBack}>내 회의 보기</button>
            </div>
            {confirmCancel ? (
              <div className="done-cancel" role="alertdialog" aria-label="회의 취소 확인">
                <p>이 회의를 취소할까요? 참석자에게는 따로 알려야 해요.</p>
                <div><button className="ghost-button" onClick={() => setConfirmCancel(false)} disabled={loading}>그대로 둘게요</button><button className="danger-button" onClick={cancel} disabled={loading}>{loading ? "취소 중..." : "회의 취소하기"}</button></div>
              </div>
            ) : (
              <details className="done-more">
                <summary>더보기</summary>
                <button type="button" className="done-more-item danger" onClick={() => setConfirmCancel(true)}>회의 취소</button>
              </details>
            )}
          </>
        )}
      </section>
    </main>
  );
}
