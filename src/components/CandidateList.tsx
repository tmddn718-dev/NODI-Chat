import { CircleCheck, CircleHelp, CircleX, Clock, TriangleAlert } from "lucide-react";
import type { Candidate } from "../types";

function formatSlot(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function formatCheckedAt(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function CandidateList({ candidates, onSelect }: { candidates: Candidate[]; onSelect: (candidate: Candidate) => void }) {
  if (!candidates.length) {
    return (
      <section className="empty-candidates" role="status">
        <CalendarBlankIcon />
        <h3>조건에 맞는 시간이 없어요</h3>
        <p>날짜를 넓히거나 꼭 참석할 사람을 바꿔보세요.</p>
      </section>
    );
  }
  return (
    <section className="candidates" aria-labelledby="candidate-title">
      <div className="candidate-header">
        <div><h2 id="candidate-title">가장 잘 맞는 시간을 찾았어요</h2><p>캘린더와 직접 받은 답변을 함께 확인했어요.</p></div>
        <span className="demo-badge">데모 데이터</span>
      </div>
      <div className="candidate-grid">
        {candidates.map((candidate, index) => (
          <article className={`candidate-card ${index === 0 && candidate.requiredAvailable ? "recommended" : ""} ${!candidate.requiredAvailable ? "unconfirmable" : ""}`} key={candidate.id}>
            <div className="candidate-topline">
              <span className={`status-badge ${candidate.requiredAvailable ? "status-success" : "status-error"}`}>
                {candidate.requiredAvailable ? <CircleCheck /> : <CircleX />}
                {candidate.requiredAvailable ? "선택 가능" : "선택할 수 없어요"}
              </span>
              <span className="candidate-score">추천 점수 <strong>{candidate.score}</strong></span>
            </div>
            <span className="rank">추천 {index + 1}</span>
            <h3>{formatSlot(candidate.start)}</h3>
            <p className="end-time"><Clock /> {formatTime(candidate.start)} - {formatTime(candidate.end)}</p>
            <div className="availability-row">
              <span><CalendarBlankIcon /> 캘린더상 빈 시간 {candidate.calendarFreeCount}명</span>
              <span><CircleCheck /> 직접 가능 응답 {candidate.manualAvailableCount}명</span>
              <span><CircleHelp /> 최종 참석 수락 {candidate.acceptedCount}명</span>
              <span className={candidate.conflictCount ? "warn" : "good"}><TriangleAlert /> 일정 충돌 {candidate.conflictCount}명</span>
              <span><CircleHelp /> 미확인 {candidate.unknownCount}명</span>
              <span className={candidate.requiredAvailable ? "good" : "warn"}>
                {candidate.requiredAvailable ? <CircleCheck /> : <TriangleAlert />}
                {candidate.requiredAvailable ? "꼭 참석할 사람 모두 가능" : "꼭 참석할 사람의 시간이 맞지 않아요"}
              </span>
              {candidate.tentative.length > 0 && <span className="warn"><CircleHelp /> 아직 몰라요 {candidate.tentative.length}명</span>}
              {candidate.noResponse.length > 0 && <span><CircleHelp /> 미응답 {candidate.noResponse.length}명</span>}
            </div>
            <p className="reason">{candidate.reason}</p>
            <span className="candidate-version">회의 조건 v{candidate.basedOnMeetingVersion} · {formatCheckedAt(candidate.checkedAt)} 최종 확인</span>
            {(candidate.unavailable.length > 0 || candidate.unknown.length > 0) && (
              <div className="conflict-note">
                {candidate.unavailable.length > 0 && <span><TriangleAlert /> 불가: {candidate.unavailable.join(", ")}</span>}
                {candidate.tentative.length > 0 && <span><CircleHelp /> 아직 몰라요: {candidate.tentative.join(", ")}</span>}
                {candidate.noResponse.length > 0 && <span><CircleHelp /> 미응답: {candidate.noResponse.join(", ")}</span>}
              </div>
            )}
            <button className={index === 0 ? "primary-button" : "secondary-button"} onClick={() => onSelect(candidate)} disabled={!candidate.requiredAvailable}>이 시간 선택하기</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function CalendarBlankIcon() {
  return <Clock size={30} />;
}
