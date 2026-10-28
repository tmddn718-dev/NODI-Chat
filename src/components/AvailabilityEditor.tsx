import { CalendarDays, CircleCheck, Clock, Copy, Link, Users } from "lucide-react";
import { useState } from "react";
import type { AvailabilityResponse, AvailabilityStatus, InvitationLink } from "../types";

const labels: Record<AvailabilityStatus, string> = {
  available: "참석 가능",
  unavailable: "참석 어려움",
  tentative: "아직 몰라요",
  no_response: "응답 전",
};

const toInputValue = (value?: string) => value?.slice(0, 16) ?? "";
const toKst = (value: string) => value ? `${value}:00+09:00` : undefined;

export function AvailabilityEditor({
  responses,
  dateStart,
  dateEnd,
  loading,
  onChange,
  onSubmit,
  inviteLinks,
  inviteLoading = false,
  inviteError,
  lastInviteSyncAt,
  onCreateInvite,
  onRefreshResponses,
}: {
  responses: AvailabilityResponse[];
  dateStart: string;
  dateEnd: string;
  loading: boolean;
  onChange: (responses: AvailabilityResponse[]) => void;
  onSubmit: () => void;
  inviteLinks?: InvitationLink[];
  inviteLoading?: boolean;
  inviteError?: string;
  lastInviteSyncAt?: string;
  onCreateInvite?: () => void;
  onRefreshResponses?: () => void;
}) {
  const answered = responses.filter((response) => response.status !== "no_response").length;
  const [copied, setCopied] = useState("");
  const [method, setMethod] = useState<"manual" | "invite">(inviteLinks?.length ? "invite" : "manual");

  const invitationUrl = (link: InvitationLink) => `${window.location.origin}/invite/${link.urlToken}`;

  async function copyInvite(link: InvitationLink) {
    await navigator.clipboard.writeText(invitationUrl(link));
    setCopied(link.attendee);
    window.setTimeout(() => setCopied(""), 1600);
  }

  async function shareInvite(link: InvitationLink) {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "NODI 회의 참석 요청",
          text: `${link.attendee}님, 회의 참석 가능 여부를 알려주세요.`,
          url: invitationUrl(link),
        });
        return;
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
      }
    }
    await copyInvite(link);
  }

  function update(attendee: string, patch: Partial<AvailabilityResponse>) {
    onChange(responses.map((response) => response.attendee === attendee ? { ...response, ...patch } : response));
  }

  function changeStatus(response: AvailabilityResponse, status: AvailabilityStatus) {
    update(response.attendee, status === "available"
      ? { status, start: `${dateStart}T09:00:00+09:00`, end: `${dateEnd}T18:00:00+09:00` }
      : { status, start: undefined, end: undefined });
  }

  return (
    <section className="availability-card" aria-labelledby="availability-title">
      <div className="availability-heading">
        <span><CalendarDays /></span>
        <div>
          <p>참석 가능 시간</p>
          <h2 id="availability-title">가능한 시간을 알려주세요</h2>
        </div>
        <strong>{answered}/{responses.length}명 응답</strong>
      </div>
      <p className="availability-help">직접 입력하거나, 초대장을 보내 답을 받을 수 있어요.</p>

      <div className="availability-methods" role="group" aria-label="참석 가능 시간 수집 방법">
        <button className={method === "manual" ? "active" : ""} onClick={() => setMethod("manual")} disabled={Boolean(inviteLinks?.length)} aria-pressed={method === "manual"}><span><strong>내가 입력할게요</strong><small>참석 여부와 시간을 직접 선택해요</small></span></button>
        <button className={method === "invite" ? "active" : ""} onClick={() => setMethod("invite")} aria-pressed={method === "invite"}><span><strong>참석자가 답해요</strong><small>초대장을 보내 답을 받아요</small></span></button>
      </div>

      {method === "invite" && onCreateInvite && (
        <div className="invite-link-panel">
          <div><Link /><span><strong>{inviteLinks?.length ? "답변을 기다리고 있어요" : "참석자마다 초대장을 만들어요"}</strong><small>{inviteLinks?.length ? "답변이 오면 바로 이 화면에 반영해요." : "앱을 설치하지 않아도 바로 답할 수 있어요."}</small></span></div>
          {inviteLinks?.length ? (
            <>
              <div className="invite-live-status" role="status"><span aria-hidden="true" /><strong>새 답변을 자동으로 확인해요</strong><small>{lastInviteSyncAt ? `${new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(lastInviteSyncAt))} 확인` : "5초마다 확인"}</small></div>
              <div className="participant-invite-links">{inviteLinks.map((link) => {
                const response = responses.find((item) => item.attendee === link.attendee);
                const status = response?.status ?? "no_response";
                return <div className="invite-link-row" key={link.attendee}><span><strong>{link.attendee}</strong><small><i className={`response-dot ${status}`} />{labels[status]} · 전용 링크</small></span><div><button className="secondary-button" onClick={() => void shareInvite(link)}>초대 보내기</button><button className="icon-button" aria-label={`${link.attendee} 초대 링크 복사`} onClick={() => void copyInvite(link)}>{copied === link.attendee ? <CircleCheck /> : <Copy />}</button></div></div>;
              })}</div>
              <p className="invite-security-note">데모에서는 자동으로 발송하지 않아요. ‘초대 보내기’를 누르면 공유창이 열리고, 지원하지 않으면 링크를 복사해요.</p>
              <button className="text-link refresh-responses" onClick={onRefreshResponses} disabled={inviteLoading}>{inviteLoading ? "확인하고 있어요..." : "지금 확인하기"}</button>
            </>
          ) : <button className="secondary-button create-invite-button" onClick={onCreateInvite} disabled={inviteLoading}>{inviteLoading ? "초대장을 만들고 있어요..." : "초대장 만들기"}</button>}
          {inviteError && <p className="dialog-error" role="alert">{inviteError}</p>}
        </div>
      )}
      <div className={`availability-list ${method === "invite" ? "invite-mode" : ""}`}>
        {responses.map((response) => (
          <article className="availability-row" key={response.attendee}>
            <div className="availability-person"><Users /><strong>{response.attendee}</strong></div>
            <label>
              <span className="sr-only">{response.attendee} 참석 상태</span>
              <select value={response.status} disabled={method === "invite"} onChange={(event) => changeStatus(response, event.target.value as AvailabilityStatus)}>
                {(Object.keys(labels) as AvailabilityStatus[]).map((status) => <option key={status} value={status}>{labels[status]}</option>)}
              </select>
            </label>
            {response.status === "available" && (
              <div className="availability-time">
                <label><Clock /><span>시작</span><input type="datetime-local" disabled={method === "invite"} value={toInputValue(response.start)} onChange={(event) => update(response.attendee, { start: toKst(event.target.value) })} /></label>
                <label><Clock /><span>종료</span><input type="datetime-local" disabled={method === "invite"} value={toInputValue(response.end)} onChange={(event) => update(response.attendee, { end: toKst(event.target.value) })} /></label>
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="availability-note"><CircleCheck /> 답변 전이거나 아직 모르는 참석자는 가능한 사람으로 세지 않아요.</div>
      <button className="primary-button availability-submit" onClick={onSubmit} disabled={loading || (method === "invite" && !inviteLinks?.length)}>{method === "invite" && !inviteLinks?.length ? "먼저 초대장을 만들어 주세요" : "추천 시간 보기"}</button>
    </section>
  );
}
