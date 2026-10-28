import { CircleAlert, CircleCheck, ClipboardCheck } from "lucide-react";
import type { MeetingDraft } from "../types";

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

export function ReviewCard({ meeting, onEdit, onProceed }: { meeting: MeetingDraft; onEdit: () => void; onProceed: () => void }) {
  const items = reviewItems(meeting);
  const done = items.filter((item) => item.ok).length;
  const complete = done === items.length;
  return (
    <section className="review-card" aria-labelledby="review-title">
      <div className="guided-heading">
        <span><ClipboardCheck /></span>
        <div><p>4 / 6단계 · 조건 검토</p><h2 id="review-title">이대로 시간을 찾을까요?</h2></div>
        <strong className="review-count">{done}/{items.length} 완료</strong>
      </div>
      <progress className="guided-progress" max="6" value="4" aria-label="6단계 중 4단계" />
      <ul className="review-list">
        {items.map((item) => (
          <li key={item.label} className={item.ok ? "ok" : "missing"}>
            {item.ok ? <CircleCheck aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
            <span><small>{item.label}</small><strong>{item.value || "아직 정하지 않았어요"}</strong></span>
          </li>
        ))}
      </ul>
      <div className="review-actions">
        <button className="secondary-button" onClick={onEdit}>수정하기</button>
        <button className="primary-button" onClick={onProceed} disabled={!complete}>추천 시간 찾기</button>
      </div>
    </section>
  );
}
