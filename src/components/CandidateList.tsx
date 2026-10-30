import { Clock } from "lucide-react";
import { type ReactNode, useState } from "react";
import { namesLabel, slotLabel } from "../format";
import { MOBILE_QUERY, useMedia } from "../useMedia";
import type { AttendanceEvidence, Candidate } from "../types";
import { CompareBar, CompareTable, type CompareColumn } from "./CompareTable";
import { recommendationState } from "../recommendationState";
import { RecommendationCard, type ReasonLine } from "./RecommendationCard";

function formatCheckedAt(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

const EVIDENCE: Record<AttendanceEvidence, string> = {
  calendar_free: "일정 충돌 없음",
  calendar_conflict: "다른 일정 있음",
  direct_available: "참석 가능 응답",
  direct_unavailable: "참석 불가 응답",
  tentative: "아직 몰라요",
  no_response: "응답 대기",
  calendar_unavailable: "일정 확인 불가",
  out_of_office: "휴가·근무 시간 외",
};
// 참석자가 많아도 상세가 끝없이 길어지지 않게 앞 8명만 보이고 나머지는 펼쳐 봐요.
function CappedItems({ names, render }: { names: string[]; render: (name: string) => ReactNode }) {
  const limit = 8;
  return <>{names.slice(0, limit).map(render)}{names.length > limit && <li className="rcard-more"><details><summary>{`외 ${names.length - limit}명 더 보기`}</summary><ul>{names.slice(limit).map(render)}</ul></details></li>}</>;
}
const rankLabel = (index: number) => (index === 0 ? "가장 추천" : `대안 ${index}`);

function toColumn(candidate: Candidate, requiredNames: string[], onSelect: (candidate: Candidate) => void): CompareColumn {
  const optional = (candidate.evidence ?? []).filter((item) => !requiredNames.includes(item.attendee)).map((item) => item.evidence);
  const count = (kinds: AttendanceEvidence[]) => optional.filter((kind) => kinds.includes(kind)).length;
  return {
    id: candidate.id,
    label: slotLabel(candidate.start),
    required: requiredNames.length ? (candidate.requiredAvailable ? "확인됨" : "확인 필요") : "지정 없음",
    possible: count(["calendar_free", "direct_available"]),
    impossible: count(["calendar_conflict", "direct_unavailable", "out_of_office"]),
    waiting: count(["no_response", "tentative"]),
    unknown: count(["calendar_unavailable"]),
    onSelect: candidate.requiredAvailable ? () => onSelect(candidate) : undefined,
  };
}

export function CandidateList({ candidates, onSelect, requiredNames = [] }: { candidates: Candidate[]; onSelect: (candidate: Candidate) => void; requiredNames?: string[] }) {
  const requiredCount = requiredNames.length;
  const [comparing, setComparing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const isMobile = useMedia(MOBILE_QUERY);
  if (!candidates.length) {
    return (
      <section className="empty-candidates" role="status">
        <Clock size={30} />
        <h3>조건에 맞는 시간이 없어요</h3>
        <p>날짜를 넓히거나 꼭 참석할 사람을 바꿔보세요.</p>
      </section>
    );
  }
  const visible = showAll ? candidates : candidates.slice(0, 3);
  const sameScore = candidates.every((candidate) => candidate.score === candidates[0].score);
  const compareColumns = visible.filter((candidate) => !isMobile || picked.length < 2 || picked.includes(candidate.id)).map((candidate) => toColumn(candidate, requiredNames, onSelect));

  return (
    <section className="candidates" aria-labelledby="candidate-title">
      <div className="candidate-header">
        <div><h2 id="candidate-title">회의 추천</h2><p>조건에 잘 맞는 순서로 정리했어요. 아직 확정 전이에요.</p></div>
        <span className="demo-badge">데모 데이터</span>
      </div>
      {candidates.length > 1 && !isMobile && <button type="button" className="rd-more compare-toggle" aria-expanded={comparing} onClick={() => setComparing((value) => !value)}>{comparing ? "비교 닫기" : "다른 시간 비교하기"}</button>}
      {comparing && <CompareTable columns={compareColumns} onClose={() => setComparing(false)} />}
      <ol className="rd-list rcard-list">
        {visible.map((candidate, index) => {
          const evidence = candidate.evidence ?? [];
          const byName = new Map(evidence.map((item) => [item.attendee, item.evidence]));
          const people = [...new Set(evidence.map((item) => item.attendee))];
          const group = (names: string[]) => <CappedItems names={names} render={(name) => <li key={name}><span>{name}</span><span>{byName.has(name) ? EVIDENCE[byName.get(name)!] : "확인 정보 없음"}</span></li>} />;
          const waiting = candidate.noResponse.length + candidate.tentative.length;
          const mine = (list: string[]) => list.filter((name) => requiredNames.includes(name));
          const requiredBad = [...mine(candidate.unavailable), ...mine(candidate.unknown)];
          const ok = candidate.requiredAvailable;
          // 상태 → 근거 → 불확실성 순서. 필수 조건은 "충족", 선택 참석자의 미응답은 "응답 대기"로 따로 보여줘요.
          const reasons: ReasonLine[] = [
            requiredCount > 0
              ? { kind: ok ? "ok" : "warn", text: ok ? "필수 참석자 조건 충족" : requiredBad.length ? `필수 참석자 ${namesLabel(requiredBad)}님 일정이 맞지 않아요` : "필수 참석자 확인이 필요해요" }
              : { kind: "plain", text: "필수 참석자 지정 없음" },
            ...(ok && candidate.conflictCount === 0 ? [{ kind: "ok" as const, text: "현재 확인된 일정 충돌 없음" }] : []),
            ...(waiting > 0 ? [{ kind: "wait" as const, text: `선택 참석자 ${waiting}명 응답 대기` }] : []),
            ...(candidate.conflictCount > 0 && requiredBad.length === 0 ? [{ kind: "warn" as const, text: `일정이 겹치는 사람 ${candidate.conflictCount}명` }] : []),
          ];
          const state = recommendationState({ requiredOk: ok, requiredConflict: requiredBad.some((name) => candidate.unavailable.includes(name)), optionalConflict: candidate.conflictCount, index });
          return (
            <RecommendationCard
              key={candidate.id}
              top={index === 0 && ok}
              label={rankLabel(index)}
              start={candidate.start}
              end={candidate.end}
              badge={state.badge}
              reasons={reasons}
              canSelect={state.canSelect}
              onSelect={() => onSelect(candidate)}
              compare={isMobile && candidates.length > 1 ? { checked: picked.includes(candidate.id), disabled: picked.length >= 3, onToggle: () => setPicked((current) => current.includes(candidate.id) ? current.filter((id) => id !== candidate.id) : [...current, candidate.id]) } : undefined}
              details={(
                <>
                  {requiredCount > 0 && <><h4>필수 참석자</h4><ul>{group(people.filter((name) => requiredNames.includes(name)))}</ul></>}
                  <h4>{requiredCount > 0 ? "선택 참석자" : "참석자"}</h4>
                  <ul>{group(people.filter((name) => !requiredNames.includes(name)))}</ul>
                  <h4>확인 결과</h4>
                  <ul>
                    <li><span>전체 참석 가능</span><span>{candidate.total}명 중 {candidate.available}명</span></li>
                    <li><span>캘린더 확인 · 직접 응답</span><span>{candidate.calendarFreeCount}명 · {candidate.manualAvailableCount}명</span></li>
                    <li><span>일정 충돌</span><span>{candidate.conflictCount}명</span></li>
                    <li><span>응답 대기·미정</span><span>{waiting}명</span></li>
                    <li><span>최신 일정 확인</span><span>{formatCheckedAt(candidate.checkedAt)}</span></li>
                    <li><span>추천 점수 (보조)</span><span>{candidate.score}점{sameScore ? " · 같은 점수는 선호 시간대·빠른 시간 순" : ""}</span></li>
                    <li><span>회의 조건</span><span>v{candidate.basedOnMeetingVersion}</span></li>
                  </ul>
                  <p className="rd-caption">캘린더상 비어 있다는 것은 참석 수락이 아니에요. 선택해도 아직 확정 전이고, 다음 단계에서 최신 일정을 다시 확인해요.</p>
                </>
              )}
            />
          );
        })}
      </ol>
      {isMobile && candidates.length > 1 && <CompareBar count={picked.length} onOpen={() => setComparing(true)} onClear={() => setPicked([])} />}
      {candidates.length > 3 && <button className="secondary-button candidate-more" onClick={() => setShowAll((value) => !value)}>{showAll ? "접기" : `후보 ${candidates.length - 3}개 더 보기`}</button>}
    </section>
  );
}
