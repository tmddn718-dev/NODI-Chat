import { Check, ChevronRight, Clock, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { buildInvitedMeetings, loadAnswers, saveAnswers, statusOf, type InvitedAnswer, type InvitedMeeting, type InvitedStatus } from "../invited";
import { Brand } from "./Brand";

const slotFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
const TABS: Array<[InvitedStatus, string]> = [["pending", "응답 필요"], ["answered", "응답 완료"], ["confirmed", "확정"]];

function deadlineLabel(iso: string, now = Date.now()) {
  const diff = Date.parse(iso) - now;
  if (diff <= 0) return "응답 마감 지남";
  const hours = Math.ceil(diff / 3_600_000);
  return hours < 24 ? `${hours}시간 뒤 마감` : `${Math.ceil(hours / 24)}일 뒤 마감`;
}

export function InvitedMeetings({ onBack }: { onBack: () => void }) {
  const [meetings] = useState(() => buildInvitedMeetings());
  const [answers, setAnswers] = useState(loadAnswers);
  const [tab, setTab] = useState<InvitedStatus>("pending");
  const [openId, setOpenId] = useState<string | null>(null);
  const counts = Object.fromEntries(TABS.map(([key]) => [key, meetings.filter((m) => statusOf(m, answers) === key).length])) as Record<InvitedStatus, number>;
  const shown = meetings.filter((meeting) => statusOf(meeting, answers) === tab);
  const open = meetings.find((meeting) => meeting.id === openId);

  function submit(meeting: InvitedMeeting, answer: InvitedAnswer) {
    const next = { ...answers, [meeting.id]: answer };
    setAnswers(next);
    saveAnswers(next);
    setOpenId(null);
    setTab("answered");
  }

  return (
    <main id="main-content" className="meetings-view">
      <header className="meetings-topbar">
        <Brand />
        <button className="ghost-button" onClick={onBack}>회의 잡기로 돌아가기</button>
      </header>
      <section className="meetings-content" aria-labelledby="invited-title">
        <div className="meetings-heading">
          <div><p className="overline">초대받은 회의</p><h1 id="invited-title">나에게 온 일정 요청</h1><p>가능한 시간을 알려 주면 주최자가 가장 잘 맞는 시간을 정해요. 이 화면은 데모 데이터예요.</p></div>
        </div>

        <div className="sub-tabs" role="tablist" aria-label="초대 상태">
          {TABS.map(([key, label]) => (
            <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "on" : ""} onClick={() => setTab(key)}>{label}<span>{counts[key]}</span></button>
          ))}
        </div>

        {shown.length ? (
          <div className="meetings-list">
            {shown.map((meeting) => {
              const status = statusOf(meeting, answers);
              const expired = Date.parse(meeting.deadlineAt) <= Date.now();
              return (
                <button className="meeting-list-row sub-row" key={meeting.id} onClick={() => setOpenId(meeting.id)}>
                  <span className="sub-avatar" aria-hidden="true">{meeting.organizer.slice(0, 1)}</span>
                  <span className="meeting-list-copy">
                    <strong>{meeting.title}</strong>
                    <small>{meeting.organizer} · {meeting.organizerTitle} · {meeting.durationMinutes}분</small>
                  </span>
                  <span className={`status-badge ${status === "confirmed" ? "status-success" : status === "answered" ? "status-info" : expired ? "status-error" : "status-warning"}`}>
                    {status === "confirmed" ? "확정" : status === "answered" ? "응답 완료" : deadlineLabel(meeting.deadlineAt)}
                  </span>
                  <ChevronRight className="sub-chevron" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="meetings-empty">
            <h2>{tab === "pending" ? "응답할 초대가 없어요" : tab === "answered" ? "응답한 초대가 아직 없어요" : "확정된 회의가 없어요"}</h2>
            <p>{tab === "pending" ? "새 초대가 오면 여기에 보여요." : "다른 탭에서 확인해 보세요."}</p>
          </div>
        )}
      </section>
      {open && <InvitedDialog meeting={open} answer={answers[open.id]} onClose={() => setOpenId(null)} onSubmit={(answer) => submit(open, answer)} />}
    </main>
  );
}

function InvitedDialog({ meeting, answer, onClose, onSubmit }: { meeting: InvitedMeeting; answer?: InvitedAnswer; onClose: () => void; onSubmit: (answer: InvitedAnswer) => void }) {
  const [mode, setMode] = useState<InvitedAnswer["mode"]>(answer?.mode ?? "pick");
  const [picks, setPicks] = useState<string[]>(answer?.picks ?? []);
  const confirmed = meeting.confirmed;
  const ready = mode !== "pick" || picks.length > 0;
  const toggle = (id: string) => setPicks((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog cd" role="dialog" aria-modal="true" aria-labelledby="invited-dialog-title">
        <header className="cd-head">
          <span className="cd-badge">{confirmed ? "회의 확정" : "시간 미확정"}</span>
          <button className="dialog-close icon-button" onClick={onClose} aria-label="닫기"><X /></button>
        </header>
        <h2 id="invited-dialog-title">{confirmed ? "확정된 회의예요" : "언제 참여할 수 있나요?"}</h2>
        <p className="cd-sub">{meeting.title} · {meeting.durationMinutes}분 · {meeting.organizer}님이 요청했어요</p>

        {confirmed ? (
          <div className="cd-section">
            <dl className="cd-grid">
              <div><dt>일시</dt><dd>{slotFmt.format(new Date(confirmed.start))}</dd></div>
              <div><dt>시간</dt><dd>{timeFmt.format(new Date(confirmed.start))} - {timeFmt.format(new Date(confirmed.end))}</dd></div>
            </dl>
            <p className="cd-note"><Check /> 데모에서는 내 캘린더에 반영하지 않아요.</p>
          </div>
        ) : (
          <>
            <div className="cd-section">
              <div className="rd-picks" role="group" aria-label="가능한 시간">
                {meeting.slots.map((item) => {
                  const on = mode === "pick" && picks.includes(item.id);
                  return (
                    <label className={`rd-pick ${on ? "on" : ""} ${mode !== "pick" ? "dim" : ""}`} key={item.id}>
                      <input type="checkbox" checked={on} disabled={mode !== "pick"} onChange={() => toggle(item.id)} />
                      <span className="rd-pick-mark" aria-hidden="true">{on && <Check />}</span>
                      <span className="rd-pick-text"><strong>{slotFmt.format(new Date(item.start))}</strong><span>{timeFmt.format(new Date(item.start))} - {timeFmt.format(new Date(item.end))}</span></span>
                      <span className="rd-pick-state">{on ? "가능" : mode === "pick" ? "선택 안 함" : ""}</span>
                    </label>
                  );
                })}
              </div>
              <label className="rd-check"><input type="checkbox" checked={mode === "none"} onChange={(event) => setMode(event.target.checked ? "none" : "pick")} /><span>모든 후보 시간이 어려워요</span></label>
              <label className="rd-check"><input type="checkbox" checked={mode === "unsure"} onChange={(event) => setMode(event.target.checked ? "unsure" : "pick")} /><span>아직 결정하기 어려워요</span></label>
            </div>
            <p className="cd-note"><Clock /> {deadlineLabel(meeting.deadlineAt)} · 고르지 않은 시간은 ‘불가’로 전달돼요. 응답은 이 기기에만 저장돼요.</p>
            <div className="dialog-actions">
              <button className="secondary-button" onClick={onClose}>닫기</button>
              <button className="primary-button" disabled={!ready} onClick={() => onSubmit({ mode, picks: mode === "pick" ? picks : [], answeredAt: new Date().toISOString() })}>{answer ? "바꾼 답변 제출하기" : "응답 제출"}</button>
            </div>
          </>
        )}
        {Date.parse(meeting.deadlineAt) <= Date.now() && !confirmed && <p className="cd-status warn"><TriangleAlert /> 응답 마감이 지났어요. 확정 전이라면 답변이 반영될 수 있어요.</p>}
      </section>
    </div>
  );
}
