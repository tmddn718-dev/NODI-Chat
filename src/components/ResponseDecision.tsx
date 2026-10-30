import { Check, Clock, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { slotLabel } from "../format";
import type { RoundSummary } from "../types";
import { StatusBadge } from "./StatusBadge";
import { namesLabel } from "../format";

const kstInput = (ms: number) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 16);

// 응답 대기 카드: 상태 → 현재 가장 유력한 시간 → 확인된 조건 → 남은 불확실성 → 선택할 행동. (참석자별 상태는 접어서 아래에)
export function ResponseDecision({ round, busy, onRemind, onProceed, onRefresh, onExtend, onCompare, onEditRequired, children }: {
  round: RoundSummary;
  busy: boolean;
  onRemind: () => void;
  onProceed: (row: RoundSummary["rows"][number]) => void;
  onRefresh: () => void;
  onExtend?: (deadlineAt: string) => void;
  onCompare?: () => void;
  onEditRequired?: () => void;
  children?: ReactNode;
}) {
  const [waitOpen, setWaitOpen] = useState(!onCompare);
  const [custom, setCustom] = useState<string | null>(null);
  const pending = round.participants.filter((p) => !p.responded);
  const top = round.rows.find((row) => row.candidate.requiredAvailable);
  const pastDeadline = Date.now() >= Date.parse(round.deadlineAt);
  const canRemind = !!round.invitedAt && round.reminderCount < 1 && !pastDeadline && pending.some((p) => p.delivery === "sent");
  const deadline = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(round.deadlineAt));
  const left = Math.max(0, Date.parse(round.deadlineAt) - Date.now());
  const leftText = `${Math.floor(left / 3_600_000) ? `${Math.floor(left / 3_600_000)}시간 ` : ""}${Math.floor((left % 3_600_000) / 60_000)}분`;
  const waiting = top ? [...(top.people?.tentative ?? []), ...(top.people?.noResponse ?? [])] : [];

  return (
    <section className="rsc" aria-label="응답 현황">
      <header className="rsc-head">
        <span className="rsc-eyebrow">참석 가능 여부 확인</span>
        {pending.length > 0 ? <StatusBadge kind="wait">{pending.length}명 대기</StatusBadge> : <StatusBadge kind="ok">모두 응답</StatusBadge>}
      </header>

      {top && (
        <div className="rsc-likely">
          <p className="rsc-likely-time">{slotLabel(top.candidate.start)}</p>
          <p className="rsc-likely-label">현재 가장 유력한 시간</p>
          <ul className="rsc-facts">
            <li className="ok"><Check aria-hidden="true" /><span>필수 참석자 조건 충족</span></li>
            {(top.people?.accepted.length ?? 0) > 0 && <li className="ok"><Check aria-hidden="true" /><span>{namesLabel(top.people!.accepted)} 참석 가능 응답</span></li>}
            {(top.people?.declined.length ?? 0) > 0 && <li className="warn"><TriangleAlert aria-hidden="true" /><span>{namesLabel(top.people!.declined)} 참석 불가 응답</span></li>}
            {waiting.length > 0 && <li className="wait"><Clock aria-hidden="true" /><span>선택 참석자 {waiting.length}명 응답 대기</span></li>}
          </ul>
        </div>
      )}
      <p className="rsc-foot">{pastDeadline ? "응답 마감 시간이 지났어요" : `${deadline} 응답 마감 예정 · 마감까지 ${leftText}`}</p>

      {!top && (
        <div className="rsc-block">
          <p className="rsc-q">꼭 참석할 사람의 시간이 맞는 후보가 없어요</p>
          <p className="rsc-note">날짜 범위를 넓혀 다른 시간을 찾아볼까요? 입력한 회의 조건은 그대로 유지돼요.</p>
          <div className="rsc-actions">
            <button className="rd-btn rsc-cta" disabled={busy} onClick={onRefresh}>다른 후보 확인하기</button>
            {onEditRequired && <button className="rd-btn secondary rsc-cta" disabled={busy} onClick={onEditRequired}>필수 참석자 조건 수정하기</button>}
          </div>
        </div>
      )}

      {top && pending.length > 0 && (
        <div className="rsc-block">
          <p className="rsc-q">어떻게 진행할까요?</p>
          <div className="rsc-actions">
            {onCompare && <button type="button" className="rd-btn rsc-cta" onClick={() => onCompare()}>다른 시간 비교하기</button>}
            <button type="button" className={`rd-btn rsc-cta ${onCompare ? "secondary" : ""}`} aria-expanded={waitOpen} aria-controls="rsc-wait" onClick={() => setWaitOpen((open) => !open)}>응답 더 기다리기</button>
          </div>
          {waitOpen && (
            <div className="rsc-wait" id="rsc-wait">
              {onExtend && (
                <div className="rd-extend" role="group" aria-label="응답 마감 연장">
                  <span className="rd-label">응답 마감 연장</span>
                  {[[0.5, "30분"], [1, "1시간"], [3, "3시간"]].map(([hours, label]) => (
                    <button key={hours} type="button" className="rd-btn m secondary" disabled={busy}
                      onClick={() => onExtend(new Date(Math.max(Date.now(), Date.parse(round.deadlineAt)) + Number(hours) * 3_600_000).toISOString())}>+{label}</button>
                  ))}
                  <button type="button" className={`rd-btn m secondary ${custom === null ? "" : "on"}`} aria-pressed={custom !== null} disabled={busy}
                    onClick={() => setCustom(custom === null ? kstInput(Math.max(Date.now(), Date.parse(round.deadlineAt)) + 3_600_000) : null)}>직접 입력</button>
                  {custom !== null && (
                    <div className="rd-extend-custom">
                      <input className="rd-input" type="datetime-local" aria-label="새 응답 마감 일시 (한국 표준시)" min={kstInput(Math.max(Date.now(), Date.parse(round.deadlineAt)) + 60_000)} value={custom} onChange={(event) => setCustom(event.target.value)} />
                      <button type="button" className="rd-btn m" disabled={busy || !custom || Date.parse(`${custom}:00+09:00`) <= Math.max(Date.now(), Date.parse(round.deadlineAt))}
                        onClick={() => { onExtend(new Date(`${custom}:00+09:00`).toISOString()); setCustom(null); }}>적용</button>
                    </div>
                  )}
                </div>
              )}
              <button type="button" className="rd-btn secondary rsc-cta" disabled={busy || !canRemind} onClick={onRemind}>
                {canRemind ? `미응답 ${pending.length}명에게 재알림 보내기` : round.reminderCount ? "재알림은 이미 보냈어요 · 응답을 기다리는 중" : "응답을 기다리는 중이에요"}
              </button>
            </div>
          )}
          <p className="rsc-caution"><TriangleAlert aria-hidden="true" />미응답자의 참석은 보장되지 않아요</p>
          <button type="button" className="rsc-link" disabled={busy} onClick={() => onProceed(top)}>현재 조건으로 확정 검토하기</button>
        </div>
      )}
      {children}
    </section>
  );
}
