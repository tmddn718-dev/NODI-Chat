import { CircleCheck, CircleHelp, Clock, TriangleAlert } from "lucide-react";
import { useState } from "react";
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

export function CandidateList({ candidates, onSelect, requiredCount = 1 }: { candidates: Candidate[]; onSelect: (candidate: Candidate) => void; requiredCount?: number }) {
  const [showAll, setShowAll] = useState(false);
  const [chosenId, setPickedId] = useState<string>();
  if (!candidates.length) {
    return (
      <section className="empty-candidates" role="status">
        <CalendarBlankIcon />
        <h3>조건에 맞는 시간이 없어요</h3>
        <p>날짜를 넓히거나 꼭 참석할 사람을 바꿔보세요.</p>
      </section>
    );
  }
  const pickedId = candidates.some((c) => c.id === chosenId) ? chosenId : candidates.find((c) => c.requiredAvailable)?.id;
  const visible = showAll ? candidates : candidates.slice(0, 3);
  const sameScore = candidates.every((candidate) => candidate.score === candidates[0].score);
  return (
    <section className="candidates" aria-labelledby="candidate-title">
      <div className="candidate-header">
        <div><h2 id="candidate-title">가장 잘 맞는 시간을 찾았어요</h2><p>캘린더와 직접 받은 답변을 함께 확인했어요.</p></div>
        <span className="demo-badge">데모 데이터</span>
      </div>
      <ol className="slot-list">
        {visible.map((candidate, index) => {
          const best = index === 0 && candidate.requiredAvailable;
          return (
            <li
              className={`slot ${best ? "best" : ""} ${pickedId === candidate.id ? "picked" : ""} ${!candidate.requiredAvailable ? "unconfirmable" : ""}`}
              key={candidate.id}
              tabIndex={candidate.requiredAvailable ? 0 : undefined}
              aria-current={pickedId === candidate.id || undefined}
              onClick={() => candidate.requiredAvailable && setPickedId(candidate.id)}
              onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); if (candidate.requiredAvailable) setPickedId(candidate.id); } }}
            >
              <div className="slot-main">
                <span className="slot-rank">{index + 1}</span>
                <div className="slot-text">
                  {best && <span className="slot-flag">가장 추천해요</span>}
                  <strong className="slot-when">{formatSlot(candidate.start)}</strong>
                  <span className="slot-range">{formatTime(candidate.start)} - {formatTime(candidate.end)}{!sameScore && ` · 추천 점수 ${candidate.score}`}</span>
                </div>
                <button className={pickedId === candidate.id ? "primary-button" : "secondary-button"} onClick={() => onSelect(candidate)} disabled={!candidate.requiredAvailable}>선택</button>
              </div>
              <p className="slot-reason">{candidate.reason}</p>
              <ul className="slot-why">
                {requiredCount > 0 && (
                  <li className={candidate.requiredAvailable ? "good" : "warn"}>
                    {candidate.requiredAvailable ? <CircleCheck /> : <TriangleAlert />}
                    <span>꼭 참석할 사람</span><b>{candidate.requiredAvailable ? "모두 가능" : "시간이 맞지 않아요"}</b>
                  </li>
                )}
                <li><CalendarBlankIcon /><span>캘린더상 빈 시간</span><b>{candidate.calendarFreeCount}명</b></li>
                <li><CircleCheck /><span>직접 가능하다고 답했어요</span><b>{candidate.manualAvailableCount}명</b></li>
                <li><CircleCheck /><span>참석을 수락했어요</span><b>{candidate.acceptedCount}명</b></li>
                <li className={candidate.conflictCount ? "warn" : ""}><TriangleAlert /><span>일정이 겹쳐요</span><b>{candidate.conflictCount}명</b>{candidate.unavailable.length > 0 && <em>{candidate.unavailable.join(", ")}</em>}</li>
                {(candidate.tentative.length > 0 || candidate.noResponse.length > 0 || candidate.unknownCount > 0) && (
                  <li><CircleHelp /><span>아직 확인 중이에요</span><b>{candidate.tentative.length + candidate.noResponse.length || candidate.unknownCount}명</b>{[...candidate.tentative, ...candidate.noResponse].length > 0 && <em>{[...candidate.tentative, ...candidate.noResponse].join(", ")}</em>}</li>
                )}
              </ul>
              <span className="candidate-version">회의 조건 v{candidate.basedOnMeetingVersion} · {formatCheckedAt(candidate.checkedAt)} 최종 확인</span>
            </li>
          );
        })}
      </ol>
      {candidates.length > 3 && <button className="secondary-button candidate-more" onClick={() => setShowAll((value) => !value)}>{showAll ? "접기" : `후보 ${candidates.length - 3}개 더 보기`}</button>}
    </section>
  );
}

function CalendarBlankIcon() {
  return <Clock size={30} />;
}
