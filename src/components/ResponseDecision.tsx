import { Check } from "lucide-react";
import { useState } from "react";
import type { RoundSummary } from "../types";

type Choice = "wait" | "proceed";
const kstInput = (ms: number) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 16);

// 응답 현황(필수 조건 먼저) + 미응답이 있을 때 "기다릴지 / 지금 확정 검토할지"를 주최자가 고르는 카드.
export function ResponseDecision({ round, busy, onRemind, onProceed, onRefresh, onExtend }: {
  round: RoundSummary;
  busy: boolean;
  onRemind: () => void;
  onProceed: (row: RoundSummary["rows"][number]) => void;
  onRefresh: () => void;
  onExtend?: (deadlineAt: string) => void;
}) {
  const [choice, setChoice] = useState<Choice>("wait");
  const [custom, setCustom] = useState<string | null>(null);
  const pending = round.participants.filter((p) => !p.responded);
  const top = round.rows.find((row) => row.candidate.requiredAvailable);
  const pastDeadline = Date.now() >= Date.parse(round.deadlineAt);
  const canRemind = !!round.invitedAt && round.reminderCount < 1 && !pastDeadline && pending.some((p) => p.delivery === "sent");
  const names = pending.map((p) => p.attendee).join(", ");
  const deadline = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(round.deadlineAt));

  return (
    <section className="rd-status" aria-label="응답 현황">
      <div className="rd-summary">
        <div className="rd-summary-row">
          <strong>필수 참석자</strong>
          <span className={`rd-badge ${top ? "success" : "warning"}`}>{top ? <><Check />조건 충족</> : "맞는 시간이 없어요"}</span>
        </div>
        <div className="rd-summary-row">
          <strong>참여하면 좋은 사람</strong>
          <span className="rd-summary-value">{pending.length ? `${names} · ${pending.length}명 미응답` : "모두 응답했어요"}</span>
        </div>
        <p className="rd-summary-foot">{pastDeadline ? "응답 마감 시간이 지났어요" : `${deadline} 응답 마감 예정`}</p>
      </div>

      {!top && (
        <div className="rd-decision">
          <p className="rd-decision-title">꼭 참석할 사람의 시간이 맞는 후보가 없어요</p>
          <p className="rd-body">날짜 범위를 넓혀 다른 시간을 찾아볼까요? 입력한 회의 조건은 그대로 유지돼요.</p>
          <button className="rd-btn" disabled={busy} onClick={onRefresh}>후보 새로 찾기</button>
        </div>
      )}

      {top && pending.length > 0 && (
        <div className="rd-decision">
          <p className="rd-decision-title">어떻게 진행할까요?</p>
          <div className="rd-options" role="radiogroup" aria-label="진행 방법">
            <label className={`rd-option ${choice === "wait" ? "on" : ""}`}>
              <input type="radio" name="decision" checked={choice === "wait"} onChange={() => setChoice("wait")} />
              <span className="rd-radio" aria-hidden="true" />
              <span><strong>응답 기다리기</strong><em>마감을 늘리거나 미응답자에게 다시 알릴 수 있어요. 응답이 오면 추천을 갱신해요.</em></span>
            </label>
            <label className={`rd-option ${choice === "proceed" ? "on" : ""}`}>
              <input type="radio" name="decision" checked={choice === "proceed"} onChange={() => setChoice("proceed")} />
              <span className="rd-radio" aria-hidden="true" />
              <span><strong>현재 조건으로 확정 검토</strong><em>미응답은 그대로 두고 마지막 확인 단계로 가요. 거기서 최신 일정을 한 번 더 확인해요.</em></span>
            </label>
          </div>
          {choice === "wait" && onExtend && (
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
          {choice === "proceed" ? (
            <button className="rd-btn" disabled={busy} onClick={() => onProceed(top)}>1순위 시간으로 확정 검토하기</button>
          ) : (
            <button className="rd-btn" disabled={busy || !canRemind} onClick={onRemind}>
              {canRemind ? `미응답 ${pending.length}명에게 재알림 보내기` : round.reminderCount ? "재알림은 이미 보냈어요 · 응답을 기다리는 중" : "응답을 기다리는 중이에요"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
