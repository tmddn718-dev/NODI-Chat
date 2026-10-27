import { CalendarBlank, Clock, MapPin, UsersThree, VideoCamera } from "@phosphor-icons/react";
import type { MeetingDraft } from "../types";

const labels = {
  morning: "오전 선호",
  afternoon: "오후 선호",
  any: "시간 무관",
};

export function MeetingSummary({ meeting }: { meeting: MeetingDraft }) {
  const attendees = meeting.attendees ?? [];
  return (
    <section className="summary-card" aria-labelledby="summary-title">
      <div className="section-heading">
        <h2 id="summary-title">회의 정보</h2>
        <span>{meeting.title ? "작성 중" : "대기 중"}</span>
      </div>
      <div className="summary-title-block">
        <p className={meeting.title ? "" : "empty-value"}>{meeting.title || "회의 제목을 알려주세요"}</p>
        {meeting.purpose && <small>{meeting.purpose}</small>}
      </div>
      <dl className="summary-list">
        <div><dt><Clock /></dt><dd>{meeting.durationMinutes ? `${meeting.durationMinutes}분` : "소요 시간 미정"}</dd></div>
        <div><dt><UsersThree /></dt><dd>{attendees.length ? attendees.join(", ") : "참석자 미정"}</dd></div>
        <div><dt><CalendarBlank /></dt><dd>{meeting.dateStart ? `${meeting.dateStart}${meeting.dateEnd && meeting.dateEnd !== meeting.dateStart ? ` - ${meeting.dateEnd}` : ""}` : "날짜 범위 미정"}</dd></div>
        <div><dt>{meeting.meetingType === "in-person" ? <MapPin /> : <VideoCamera />}</dt><dd>{meeting.meetingType === "in-person" ? meeting.location || "대면 회의" : meeting.meetingType === "online" ? "온라인 회의" : "방식 미정"}</dd></div>
      </dl>
      {meeting.preferredTime && <span className="soft-tag">{labels[meeting.preferredTime]}</span>}
    </section>
  );
}
