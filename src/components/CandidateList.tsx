import { ChevronDown, CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { useState } from "react";
import type { AttendanceEvidence, Candidate } from "../types";

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

const EVIDENCE: Record<AttendanceEvidence, string> = {
  calendar_free: "캘린더에서 확인 · 가능",
  calendar_conflict: "캘린더 일정과 겹쳐요",
  direct_available: "직접 응답 · 가능",
  direct_unavailable: "직접 응답 · 어려워요",
  tentative: "아직 몰라요",
  no_response: "응답 대기",
  calendar_unavailable: "캘린더를 확인할 수 없어요",
};
const rankLabel = (index: number) => (index === 0 ? "가장 추천" : `대안 ${index}`);

export function CandidateList({ candidates, onSelect, requiredNames = [] }: { candidates: Candidate[]; onSelect: (candidate: Candidate) => void; requiredNames?: string[] }) {
  const requiredCount = requiredNames.length;
  const [openId, setOpenId] = useState<string>();
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
        <div><h2 id="candidate-title">가장 잘 맞는 시간을 찾았어요</h2><p>조건에 잘 맞는 순서로 정리했어요. 아직 확정 전이에요.</p></div>
        <span className="demo-badge">데모 데이터</span>
      </div>
      <ol className="rd-list candidate-rd-list">
        {visible.map((candidate, index) => {
          const picked = pickedId === candidate.id;
          const evidence = candidate.evidence ?? [];
          const mine = (list: string[]) => list.filter((name) => requiredNames.includes(name));
          const requiredBad = [...mine(candidate.unavailable), ...mine(candidate.unknown)];
          const waiting = candidate.noResponse.length + candidate.tentative.length;
          const notices = [
            candidate.noResponse.length ? `미응답 ${candidate.noResponse.length}명` : "",
            candidate.tentative.length ? `아직 몰라요 ${candidate.tentative.length}명` : "",
          ].filter(Boolean);
          const open = openId === candidate.id;
          const byName = new Map(evidence.map((item) => [item.attendee, item.evidence]));
          const people = [...new Set([...evidence.map((item) => item.attendee)])];
          const group = (names: string[]) => names.map((name) => <li key={name}><span>{name}</span><span>{byName.has(name) ? EVIDENCE[byName.get(name)!] : "확인 정보 없음"}</span></li>);
          const status = candidate.requiredAvailable ? "선택 가능" : requiredBad.some((name) => candidate.unavailable.includes(name)) ? "선택 불가" : "확인 필요";
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
                <span className={`rd-badge ${index === 0 ? "recommend" : "neutral"}`}>{rankLabel(index)}</span>
                <span className={`rd-badge ${candidate.requiredAvailable ? "success" : "warning"}`}>{candidate.requiredAvailable ? <CircleCheck /> : <TriangleAlert />}{status}</span>
              </div>
              <p className="rd-slot-time">{formatSlot(candidate.start)}</p>
              <p className="rd-slot-range">{formatTime(candidate.start)} ~ {formatTime(candidate.end)}</p>
              <ul className="rd-evidence">
                {requiredCount > 0 && (
                  <li className={candidate.requiredAvailable ? "ok" : "warn"}>
                    {candidate.requiredAvailable ? <CircleCheck aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
                    <span>{candidate.requiredAvailable ? `필수 참석자 ${requiredCount}명 모두 가능` : requiredBad.length ? `필수 참석자 ${requiredBad.join(", ")}님 일정이 맞지 않아요` : "필수 참석자 확인이 필요해요"}</span>
                  </li>
                )}
                <li className="plain"><span>전체 {candidate.total}명 중 {candidate.available}명 참석 가능</span></li>
                {(candidate.calendarFreeCount > 0 || candidate.manualAvailableCount > 0) && <li className="plain sub"><span>캘린더 확인 {candidate.calendarFreeCount}명 · 직접 응답 {candidate.manualAvailableCount}명</span></li>}
                {notices.length > 0 && <li className="warn"><TriangleAlert aria-hidden="true" /><span>{notices.join(" · ")}</span></li>}
                {candidate.conflictCount > 0 && requiredBad.length === 0 && <li className="plain sub"><span>일정이 겹치는 사람 {candidate.conflictCount}명</span></li>}
              </ul>
              <button type="button" className="rd-more" aria-expanded={open} onClick={(event) => { event.stopPropagation(); setOpenId(open ? undefined : candidate.id); }}>
                추천 근거 자세히 보기 <ChevronDown aria-hidden="true" className={open ? "up" : ""} />
              </button>
              {open && (
                <div className="rd-detail">
                  {requiredCount > 0 && <><h4>필수 참석자</h4><ul>{group(people.filter((name) => requiredNames.includes(name)))}</ul></>}
                  <h4>{requiredCount > 0 ? "다른 참석자" : "참석자"}</h4>
                  <ul>{group(people.filter((name) => !requiredNames.includes(name)))}</ul>
                  <h4>확인 결과</h4>
                  <ul>
                    <li><span>일정 충돌</span><span>{candidate.conflictCount}명</span></li>
                    <li><span>응답 대기·미정</span><span>{waiting}명</span></li>
                    <li><span>최신 일정 확인</span><span>{formatCheckedAt(candidate.checkedAt)}</span></li>
                    <li><span>추천 점수 (보조)</span><span>{candidate.score}점{sameScore ? " · 같은 점수는 선호 시간대·빠른 시간 순" : ""}</span></li>
                    <li><span>회의 조건</span><span>v{candidate.basedOnMeetingVersion}</span></li>
                  </ul>
                  <p className="rd-caption">캘린더상 비어 있다는 것은 참석 수락이 아니에요.</p>
                </div>
              )}
              <button className={`rd-btn m ${picked ? "" : "secondary"}`} onClick={(event) => { event.stopPropagation(); onSelect(candidate); }} disabled={!candidate.requiredAvailable}>{candidate.requiredAvailable ? <><span className="btn-long">이 시간 선택</span><span className="btn-short">선택</span></> : "선택 불가"}</button>
              <p className="rd-caption">선택해도 아직 확정 전이에요. 다음 단계에서 최신 일정을 다시 확인해요.</p>
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
