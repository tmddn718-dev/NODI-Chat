import { CalendarBlank, CheckCircle, Clock, Warning } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import type { AvailabilityStatus, InvitationSummary } from "../types";
import { Brand } from "./Brand";

type ResponseStatus = Exclude<AvailabilityStatus, "no_response">;
const toKst = (value: string) => value ? `${value}:00+09:00` : undefined;

export function InviteResponseScreen({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<InvitationSummary | null>(null);
  const [status, setStatus] = useState<ResponseStatus>("available");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.invitation(token)
      .then(({ invitation: value }) => {
        setInvitation(value);
        if (value.currentStatus !== "no_response") setStatus(value.currentStatus);
        setStart(value.meeting.dateStart ? `${value.meeting.dateStart}T09:00` : "");
        setEnd(value.meeting.dateEnd ? `${value.meeting.dateEnd}T18:00` : "");
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "초대를 불러오지 못했어요."))
      .finally(() => setLoading(false));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await api.respondToInvitation(token, {
        attendee: invitation!.attendee,
        status,
        start: status === "available" ? toKst(start) : undefined,
        end: status === "available" ? toKst(end) : undefined,
      });
      setInvitation((current) => current ? {
        ...current,
        currentStatus: status,
      } : current);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "답변을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main id="main-content" className="boot-screen" aria-label="초대를 불러오는 중"><span className="boot-logo">N</span><div className="boot-line" /></main>;

  if (!invitation) return (
    <main id="main-content" className="invite-view"><section className="invite-card error-state"><Warning weight="duotone" /><h1>초대장을 열 수 없어요</h1><p>{error}</p></section></main>
  );

  return (
    <main id="main-content" className="invite-view">
      <header className="invite-topbar"><Brand /><span>일정 응답</span></header>
      <section className="invite-card" aria-labelledby="invite-title">
        <span className="invite-icon"><CalendarBlank weight="duotone" /></span>
        <p className="overline">NODI 회의 초대</p>
        <h1 id="invite-title">{invitation.meeting.title}</h1>
        <p className="invite-purpose">{invitation.meeting.purpose}</p>
        <div className="invite-meta"><span><Clock /> {invitation.meeting.durationMinutes}분</span><span><CalendarBlank /> {invitation.meeting.dateStart} – {invitation.meeting.dateEnd}</span></div>
        <div className="invite-identity"><strong>{invitation.attendee}님만 답할 수 있어요</strong><span>{new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(invitation.expiresAt))}까지</span></div>
        <p className="invite-progress">다른 참석자의 이름과 일정은 보여주지 않아요.</p>
        <form className="invite-form" onSubmit={submit}>
          <div className="manual-response-mode"><CheckCircle weight="duotone" /><span><strong>직접 알려주세요</strong><small>캘린더를 연결하지 않아도 괜찮아요.</small></span></div>
          <fieldset><legend>참석할 수 있나요?</legend><div className="response-options">{(["available", "unavailable", "tentative"] as ResponseStatus[]).map((value) => <label key={value}><input type="radio" name="status" value={value} checked={status === value} onChange={() => { setStatus(value); setSaved(false); }} /><span>{value === "available" ? "참석 가능" : value === "unavailable" ? "참석 어려움" : "아직 몰라요"}</span></label>)}</div></fieldset>
          {status === "available" && <div className="invite-time-fields"><label>가능 시작<input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required /></label><label>가능 종료<input type="datetime-local" value={end} min={start} onChange={(event) => setEnd(event.target.value)} required /></label></div>}
          {error && <p className="dialog-error" role="alert">{error}</p>}
          {saved && <p className="invite-success" role="status"><CheckCircle weight="fill" /> 답변을 보냈어요. 이 화면에서 언제든 바꿀 수 있어요.</p>}
          <button className="primary-button" disabled={saving}>{saving ? "보내고 있어요..." : saved ? "바꾼 답변 보내기" : "답변 보내기"}</button>
        </form>
      </section>
    </main>
  );
}
