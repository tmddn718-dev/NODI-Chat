import { CheckCircle, Clock, Question, UsersThree, Warning } from "@phosphor-icons/react";
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

export function CandidateList({ candidates, onSelect }: { candidates: Candidate[]; onSelect: (candidate: Candidate) => void }) {
  if (!candidates.length) {
    return (
      <section className="empty-candidates" role="status">
        <CalendarBlankIcon />
        <h3>가능한 시간이 없습니다</h3>
        <p>날짜 범위나 필수 참석자 조건을 조정해 주세요.</p>
      </section>
    );
  }
  return (
    <section className="candidates" aria-labelledby="candidate-title">
      <div className="candidate-header">
        <div><h2 id="candidate-title">추천 시간</h2><p>데모 캘린더 기준 상위 3개</p></div>
        <span className="demo-badge">데모 데이터</span>
      </div>
      <div className="candidate-grid">
        {candidates.map((candidate, index) => (
          <article className="candidate-card" key={candidate.id}>
            <div className="candidate-topline">
              <span className="rank">추천 {index + 1}</span>
              <strong>{candidate.score}<small>점</small></strong>
            </div>
            <h3>{formatSlot(candidate.start)}</h3>
            <p className="end-time"><Clock /> {formatTime(candidate.start)} - {formatTime(candidate.end)}</p>
            <div className="availability-row">
              <span><UsersThree /> {candidate.available}/{candidate.total}명 가능</span>
              <span className={candidate.requiredAvailable ? "good" : "warn"}>
                {candidate.requiredAvailable ? <CheckCircle weight="fill" /> : <Warning weight="fill" />}
                {candidate.requiredAvailable ? "필수 참석자 가능" : "필수 참석자 확인 필요"}
              </span>
            </div>
            <p className="reason">{candidate.reason}</p>
            {(candidate.unavailable.length > 0 || candidate.unknown.length > 0) && (
              <div className="conflict-note">
                {candidate.unavailable.length > 0 && <span><Warning /> 불가: {candidate.unavailable.join(", ")}</span>}
                {candidate.unknown.length > 0 && <span><Question /> 미확인: {candidate.unknown.join(", ")}</span>}
              </div>
            )}
            <button className="secondary-button" onClick={() => onSelect(candidate)} disabled={!candidate.requiredAvailable}>이 시간 선택</button>
          </article>
        ))}
      </div>
    </section>
  );
}

function CalendarBlankIcon() {
  return <Clock size={30} weight="duotone" />;
}
