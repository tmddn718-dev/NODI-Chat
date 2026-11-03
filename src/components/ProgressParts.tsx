import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { MOBILE_QUERY, useMedia } from "../useMedia";
import { STAGE_TITLES } from "../guided";

export type EditableField = "title" | "purpose" | "durationMinutes" | "attendees" | "requiredAttendees" | "preferredTime" | "dateStart";

// 진행 헤더: 단계(Step) · 처리 상태(Status) · 다음 행동(Action)을 따로 관리해요. 큰 4단계 카드 대신 한 줄로 줄이고, 자세한 단계는 펼쳐서 봐요.
// 웹은 헤더 아래로 펼치고, 모바일은 바텀시트로 열어요. 응답 대기는 별도 단계가 아니라 2단계 안의 상태예요.
export type Stage = 1 | 2 | 3 | 4;
// sub: 현재 단계 안의 하위 진행(예: "질문 3/8 · 회의 시간"). 전체 단계(1/4)와 분리해서 보여줘요.
export type ProgressInfo = { stage: Stage; status: string; title: string; helper: string; next: string; sub?: string; count?: string; task?: string };
// 상태 칩 문구: 화면 위쪽에는 "지금 무슨 상태인지"만 짧게 보여줘요. 단계 번호(1/4)·질문 번호(4/8)는 펼쳐야 보여요.
const CHIP: Record<string, string> = { "입력 중": "조건 입력 중", "탐색 중": "시간 탐색 중", "확정 검토": "확정 전 확인" };

export function ProgressHeader({ info }: { info: ProgressInfo }) {
  const [open, setOpen] = useState(false);
  const mobile = useMedia(MOBILE_QUERY);
  const panelId = useId();
  useEffect(() => {
    if (!open || !mobile) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, mobile]);

  const stateOf = (index: number) => (index + 1 < info.stage ? "done" : index + 1 === info.stage ? "current" : "todo");
  const list = (
    <ol className="progress-stages">
      {STAGE_TITLES.map((title, index) => {
        const state = stateOf(index);
        return (
          <li key={title} className={state} aria-current={state === "current" ? "step" : undefined}>
            <span className="progress-node" aria-hidden="true">{state === "done" ? <Check /> : index + 1}</span>
            <span className="progress-stage-name">{title}</span>
            <span className="progress-stage-state">{state === "done" ? "완료" : state === "current" ? info.status : "예정"}</span>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="progress-header">
      <button type="button" className="progress-bar-button" aria-expanded={open} aria-controls={panelId} aria-label={`${CHIP[info.status] ?? info.status} ${info.task ?? info.helper ?? info.title} 진행 상태 보기`} onClick={() => setOpen((value) => !value)}>
        <span className="progress-chip">{CHIP[info.status] ?? info.status}</span>
        <span className="progress-task">{info.task ?? (info.helper || info.title)}</span>
        <ChevronDown aria-hidden="true" className={`progress-chevron ${open ? "up" : ""}`} />
      </button>
      {open && !mobile && (
        <div className="progress-detail" id={panelId}>
          <p className="progress-title">{info.title}</p>
          {info.sub && <p className="progress-note">{info.sub}</p>}
          {list}
          <p className="progress-next">다음 행동 · {info.next}</p>
        </div>
      )}
      {open && mobile && (
        <div className="progress-sheet-root">
          <div className="sheet-scrim progress-scrim" onClick={() => setOpen(false)} />
          <section className="progress-sheet" id={panelId} role="dialog" aria-modal="true" aria-label="진행 상태">
            <span className="sheet-handle" aria-hidden="true" />
            <p className="progress-title">{info.title}</p>
            {(info.sub || info.helper) && <p className="progress-note">{[info.sub, info.helper].filter(Boolean).join(" · ")}</p>}
            {list}
            <p className="progress-next">다음 행동 · {info.next}</p>
            <button type="button" className="primary-button" onClick={() => setOpen(false)}>확인</button>
          </section>
        </div>
      )}
    </div>
  );
}
