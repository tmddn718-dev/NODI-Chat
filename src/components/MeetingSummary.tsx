import { Calendar, CircleAlert, Clock, Globe, MapPin, Users, Video } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import type { MeetingDraft } from "../types";
import { namesLabel } from "../format";

const labels = {
  morning: "오전 선호",
  afternoon: "오후 선호",
  any: "시간 무관",
};

const splitNames = (value: string) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];

export function MeetingSummary({ meeting, onChange, proposal, status, onEditField, interpreted }: { meeting: MeetingDraft; onChange?: (meeting: MeetingDraft) => void; proposal?: { field: string; value: unknown } | null; status?: string; interpreted?: string[]; onEditField?: (field: "durationMinutes" | "attendees" | "requiredAttendees" | "dateStart") => void }) {
  const attendees = meeting.attendees ?? [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(meeting);
  const [attendeeText, setAttendeeText] = useState(attendees.join(", "));
  const [requiredText, setRequiredText] = useState((meeting.requiredAttendees ?? []).join(", "));

  // 입력한 개수보다 "무엇이 정해졌고 무엇을 확인해야 하는지"를 먼저 보여줘요.
  const needs = [
    !meeting.title && "회의 종류",
    !meeting.purpose && "회의 목적",
    !meeting.durationMinutes && (proposal?.field === "durationMinutes" ? `시간 · 추천 ${String(proposal.value)}분 (확인 전)` : "회의 시간"),
    !attendees.length && "참석자",
    attendees.length > 0 && meeting.requiredAttendees === undefined && "꼭 참석할 사람",
    !meeting.dateStart && "날짜 범위",
    !meeting.preferredTime && "선호 시간대",
  ].filter(Boolean) as string[];

  useEffect(() => {
    setDraft(meeting);
    setAttendeeText((meeting.attendees ?? []).join(", "));
    setRequiredText((meeting.requiredAttendees ?? []).join(", "));
  }, [meeting]);

  function save(event: FormEvent) {
    event.preventDefault();
    const nextAttendees = splitNames(attendeeText);
    const required = draft.requiredAttendees === undefined && !requiredText.trim()
      ? undefined
      : splitNames(requiredText).filter((name) => nextAttendees.includes(name));
    onChange?.({ ...draft, attendees: nextAttendees, requiredAttendees: required });
    setEditing(false);
  }

  return (
    <section className="summary-card" aria-labelledby="summary-title">
      <div className="section-heading">
        <h2 id="summary-title">지금까지 정한 내용</h2>
        {onChange ? <div className="summary-heading-actions"><span>{status ?? "조건 입력 중"}</span><button className="summary-edit-button" onClick={() => setEditing((value) => !value)}>{editing ? "닫기" : "바꾸기"}</button></div> : <span>{meeting.title ? "작성 중" : "시작 전"}</span>}
      </div>
      {editing ? (
        <form className="summary-edit-form" onSubmit={save}>
          <label>회의명<input value={draft.title ?? ""} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>목적<textarea rows={2} value={draft.purpose ?? ""} onChange={(event) => setDraft({ ...draft, purpose: event.target.value })} /></label>
          <label>소요 시간(분)<input type="number" min="15" max="480" step="15" value={draft.durationMinutes ?? ""} onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) || undefined })} /></label>
          <label>참석자(쉼표로 구분)<input value={attendeeText} onChange={(event) => setAttendeeText(event.target.value)} /></label>
          <label>꼭 참석할 사람<input value={requiredText} onChange={(event) => setRequiredText(event.target.value)} /></label>
          <div className="summary-date-fields"><label>시작일<input type="date" value={draft.dateStart ?? ""} onChange={(event) => setDraft({ ...draft, dateStart: event.target.value })} /></label><label>종료일<input type="date" value={draft.dateEnd ?? ""} min={draft.dateStart} onChange={(event) => setDraft({ ...draft, dateEnd: event.target.value })} /></label></div>
          <label>선호 시간<select value={draft.preferredTime ?? ""} onChange={(event) => setDraft({ ...draft, preferredTime: event.target.value as MeetingDraft["preferredTime"] })}><option value="">선택</option><option value="morning">오전</option><option value="afternoon">오후</option><option value="any">상관없음</option></select></label>
          <button className="primary-button">저장하기</button>
        </form>
      ) : (
        <>
          <div className="summary-title-block">
            <p className={meeting.title ? "" : "empty-value"}>{meeting.title || "어떤 회의인지 알려주세요"}</p>
            {meeting.purpose && <small>{meeting.purpose}</small>}
          </div>
          <h3 className="summary-sub">확정된 조건</h3>
          <dl className="summary-list">
            {meeting.durationMinutes ? <div><dt><Clock /></dt><dd>{meeting.durationMinutes}분</dd>{onEditField && <button type="button" className="soft-pill row-edit" onClick={() => onEditField("durationMinutes")}>수정</button>}</div> : null}
            {attendees.length > 0 && <div><dt><Users /></dt><dd>{namesLabel(attendees)}</dd>{onEditField && <button type="button" className="soft-pill row-edit" onClick={() => onEditField("attendees")}>수정</button>}</div>}
            {meeting.requiredAttendees !== undefined && <div><dt><Users /></dt><dd>{meeting.requiredAttendees.length ? `${namesLabel(meeting.requiredAttendees)} 꼭 참석` : "꼭 참석할 사람 없음"}</dd>{onEditField && <button type="button" className="soft-pill row-edit" onClick={() => onEditField("requiredAttendees")}>수정</button>}</div>}
            {meeting.dateStart && <div><dt><Calendar /></dt><dd>{`${meeting.dateStart}${meeting.dateEnd && meeting.dateEnd !== meeting.dateStart ? ` - ${meeting.dateEnd}` : ""}`}</dd>{onEditField && <button type="button" className="soft-pill row-edit" onClick={() => onEditField("dateStart")}>수정</button>}</div>}
            <div><dt><Globe /></dt><dd>{meeting.timezone ?? "Asia/Seoul"} · 데모 기준</dd></div>
            {meeting.meetingType && <div><dt>{meeting.meetingType === "in-person" ? <MapPin /> : <Video />}</dt><dd>{meeting.meetingType === "in-person" ? meeting.location || "대면 회의" : "온라인 회의"}</dd></div>}
          </dl>
          {interpreted && interpreted.length > 0 && (
            <>
              <h3 className="summary-sub">AI가 해석한 내용</h3>
              <ul className="summary-interpreted">{interpreted.map((item) => <li key={item}>{item}</li>)}</ul>
            </>
          )}
          {needs.length > 0 && (
            <>
              <h3 className="summary-sub need">확인 필요</h3>
              <ul className="summary-needs">
                {needs.map((item) => <li key={item}><CircleAlert aria-hidden="true" />{item}</li>)}
              </ul>
            </>
          )}
          {meeting.preferredTime && <span className="soft-tag">{labels[meeting.preferredTime]}</span>}
        </>
      )}
    </section>
  );
}
