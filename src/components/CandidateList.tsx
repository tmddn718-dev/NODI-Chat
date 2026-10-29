import { CircleCheck, Clock, TriangleAlert } from "lucide-react";
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
      <ol className="rd-list candidate-rd-list">
        {visible.map((candidate, index) => {
          const picked = pickedId === candidate.id;
          const names = [
            candidate.unavailable.length ? `불가: ${candidate.unavailable.join(", ")}` : "",
            candidate.tentative.length ? `아직 몰라요: ${candidate.tentative.join(", ")}` : "",
            candidate.noResponse.length ? `미응답: ${candidate.noResponse.join(", ")}` : "",
          ].filter(Boolean);
          return (
            <li
              className={`rd-slot pickable ${picked ? "picked" : ""} ${!candidate.requiredAvailable ? "unconfirmable" : ""}`}
              key={candidate.id}
              tabIndex={candidate.requiredAvailable ? 0 : undefined}
              aria-current={picked || undefined}
              onClick={() => candidate.requiredAvailable && setPickedId(candidate.id)}
              onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); if (candidate.requiredAvailable) setPickedId(candidate.id); } }}
            >
              <div className="rd-slot-top">
                <span className={`rd-badge ${candidate.requiredAvailable ? "success" : "warning"}`}>
                  {candidate.requiredAvailable ? <CircleCheck /> : <TriangleAlert />}
                  {requiredCount > 0 ? (candidate.requiredAvailable ? "필수 참석자 확인됨" : "필수 참석자 시간이 맞지 않아요") : (candidate.requiredAvailable ? "선택 가능" : "선택 불가")}
                </span>
                <span className={`rd-badge ${index === 0 ? "recommend" : "neutral"}`}>{index + 1}순위{!sameScore ? ` · ${candidate.score}점` : ""}</span>
              </div>
              <p className="rd-slot-time">{formatSlot(candidate.start)}</p>
              <p className="rd-reason">{candidate.reason}</p>
              <dl className="rd-stats">
                <div><dt>캘린더 빈 시간</dt><dd>{candidate.calendarFreeCount}</dd></div>
                <div><dt>직접 가능</dt><dd>{candidate.manualAvailableCount}</dd></div>
                <div><dt>일정 충돌</dt><dd>{candidate.conflictCount}</dd></div>
                <div><dt>미확인</dt><dd>{candidate.unknownCount}</dd></div>
              </dl>
              {names.length > 0 && <p className="rd-caption">{names.join(" · ")}</p>}
              <p className="rd-caption">{formatTime(candidate.start)} - {formatTime(candidate.end)} · {formatCheckedAt(candidate.checkedAt)} 확인 · 회의 조건 v{candidate.basedOnMeetingVersion}</p>
              <button className={`rd-btn m ${picked ? "" : "secondary"}`} onClick={(event) => { event.stopPropagation(); onSelect(candidate); }} disabled={!candidate.requiredAvailable}>{candidate.requiredAvailable ? <><span className="btn-long">이 시간으로 정하기</span><span className="btn-short">정하기</span></> : "선택 불가"}</button>
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
