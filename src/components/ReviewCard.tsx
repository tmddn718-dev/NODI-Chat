import { CircleAlert, Info, Pencil } from "lucide-react";
import type { MeetingDraft } from "../types";
import { NodiMark } from "./NodiMark";

const timeLabels = { morning: "오전", afternoon: "오후", any: "시간대 무관" };

export function reviewItems(meeting: MeetingDraft) {
  const attendees = meeting.attendees ?? [];
  const required = meeting.requiredAttendees;
  const optionalCount = required ? attendees.length - required.length : 0;
  const range = meeting.dateStart ? `${meeting.dateStart}${meeting.dateEnd && meeting.dateEnd !== meeting.dateStart ? ` – ${meeting.dateEnd}` : ""}` : "";
  return [
    { label: "회의", value: [meeting.title, meeting.purpose].filter(Boolean).join(" · "), ok: Boolean(meeting.title && meeting.purpose) },
    { label: "소요 시간", value: meeting.durationMinutes ? `${meeting.durationMinutes}분` : "", ok: Boolean(meeting.durationMinutes) },
    { label: "꼭 참석할 사람", value: required ? (required.length ? `${required.length}명 · ${required.join(", ")}` : "없음") : "", ok: required !== undefined },
    { label: "참여하면 좋은 사람", value: required ? (optionalCount ? `${optionalCount}명` : "없음") : "", ok: required !== undefined && attendees.length > 0 },
    { label: "날짜와 시간대", value: meeting.dateStart && meeting.dateEnd && meeting.preferredTime ? `${range} · ${timeLabels[meeting.preferredTime]}` : "", ok: Boolean(meeting.dateStart && meeting.dateEnd && meeting.preferredTime) },
    { label: "시간대", value: meeting.timezone ?? "Asia/Seoul", ok: true },
  ];
}

const md = (date?: string) => (date ? date.slice(5).replace("-", ".") : "");

export function ReviewCard({ meeting, onEdit, onProceed }: { meeting: MeetingDraft; onEdit: () => void; onProceed: () => void }) {
  const items = reviewItems(meeting);
  const done = items.filter((item) => item.ok).length;
  const complete = done === items.length;
  const ok = (label: string) => items.find((item) => item.label === label)?.ok ?? false;
  const required = meeting.requiredAttendees;
  const optional = required ? (meeting.attendees ?? []).filter((name) => !required.includes(name)) : [];
  const missing = <span className="cd-missing"><CircleAlert aria-hidden="true" />아직 정하지 않았어요</span>;
  const range = meeting.dateStart && meeting.dateEnd && meeting.preferredTime
    ? `${md(meeting.dateStart)}${meeting.dateEnd !== meeting.dateStart ? ` ~ ${md(meeting.dateEnd)}` : ""} · ${timeLabels[meeting.preferredTime]}`
    : "";
  return (
    <section className="guided-card review-card" aria-labelledby="review-title">
      <div className="guided-heading">
        <span className="heading-logo"><NodiMark /></span>
        <div><p>회의 조건 정하기 · 확인</p><h2 id="review-title">이 조건으로 가능한 시간을 찾아볼까요?</h2></div>
        <strong className="review-count">{done}/{items.length} 완료</strong>
      </div>
      <p className="cd-sub">잘못 이해한 내용이 있다면 수정해 주세요. 확인되면 캘린더를 먼저 살펴 가능한 후보를 찾고, 필요한 참석자에게만 가능 여부를 물어볼게요.</p>

      <div className="cd-section">
        <div className="cd-titlebar">
          <div className="cd-title">
            {ok("회의") ? <><strong>{meeting.title}</strong><span>{meeting.purpose}</span></> : missing}
          </div>
          <button className="icon-button" onClick={onEdit} aria-label="회의 조건 수정"><Pencil /></button>
        </div>
        <dl className="cd-grid">
          <div><dt>회의 시간</dt><dd>{ok("소요 시간") ? `${meeting.durationMinutes}분` : missing}</dd></div>
          <div><dt>날짜 범위</dt><dd>{ok("날짜와 시간대") ? range : missing}</dd></div>
        </dl>
      </div>

      <div className="cd-section">
        <div className="cd-people">
          <div><strong>필수 참석자</strong><span>{required ? (required.length ? required.join(", ") : "없음") : missing}</span></div>
          {required && <em>{required.length}명</em>}
        </div>
        <div className="cd-people">
          <div><strong>참여하면 좋은 사람</strong><span>{required ? (optional.length ? optional.join(", ") : "없음") : missing}</span></div>
          {required && <em>{optional.length}명</em>}
        </div>
      </div>

      <p className="cd-note"><Info /> 추천 시간 검색은 회의 확정이 아니에요. 확인 가능한 일정 정보를 바탕으로 후보를 제안해요. 시간대는 {meeting.timezone ?? "Asia/Seoul"} 기준이에요.</p>
      <div className="review-actions">
        <button className="secondary-button" onClick={onEdit}>조건 수정하기</button>
        <button className="primary-button" onClick={onProceed} disabled={!complete}>가능한 시간 찾기</button>
      </div>
    </section>
  );
}
