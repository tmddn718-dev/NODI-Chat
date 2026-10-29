import { Check, ChevronDown, Pencil } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { MOBILE_QUERY, useMedia } from "../useMedia";
import { STAGE_TITLES } from "../guided";
import type { MeetingDraft } from "../types";

export type EditableField = "title" | "purpose" | "durationMinutes" | "attendees" | "requiredAttendees" | "preferredTime" | "dateStart";

// 진행 헤더: 단계(Step) · 처리 상태(Status) · 다음 행동(Action)을 따로 관리해요. 큰 4단계 카드 대신 한 줄로 줄이고, 자세한 단계는 펼쳐서 봐요.
// 웹은 헤더 아래로 펼치고, 모바일은 바텀시트로 열어요. 응답 대기는 별도 단계가 아니라 2단계 안의 상태예요.
export type Stage = 1 | 2 | 3 | 4;
export type ProgressInfo = { stage: Stage; status: string; title: string; helper: string; next: string };

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
      <button type="button" className="progress-bar-button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <span className="progress-line">
          <strong>{info.stage}/{STAGE_TITLES.length} · {STAGE_TITLES[info.stage - 1]}</strong>
          <span className="progress-chip">{info.status}</span>
        </span>
        <span className="progress-segments" aria-hidden="true">
          {STAGE_TITLES.map((title, index) => <i key={title} className={stateOf(index)} />)}
        </span>
        <span className="progress-helper">{info.helper}</span>
        <ChevronDown aria-hidden="true" className={`progress-chevron ${open ? "up" : ""}`} />
      </button>
      {open && !mobile && (
        <div className="progress-detail" id={panelId}>
          <p className="progress-title">{info.title}</p>
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
            {list}
            <p className="progress-next">다음 행동 · {info.next}</p>
            <button type="button" className="primary-button" onClick={() => setOpen(false)}>확인</button>
          </section>
        </div>
      )}
    </div>
  );
}

const TIME = { morning: "오전", afternoon: "오후", any: "시간대 무관" };

// 이미 답한 질문은 큰 카드 대신 한 줄 요약으로 접고, 항목마다 바로 수정할 수 있게 해요.
export function CompletedConditions({ meeting, onEdit }: { meeting: MeetingDraft; onEdit: (field: EditableField) => void }) {
  const attendees = meeting.attendees ?? [];
  const items: Array<{ field: EditableField; label: string; value: string }> = [
    meeting.title && { field: "title" as const, label: "회의", value: meeting.title },
    meeting.purpose && { field: "purpose" as const, label: "목적", value: meeting.purpose },
    meeting.durationMinutes && { field: "durationMinutes" as const, label: "시간", value: `${meeting.durationMinutes}분` },
    attendees.length && { field: "attendees" as const, label: "참석자", value: `${attendees.length}명` },
    meeting.requiredAttendees !== undefined && { field: "requiredAttendees" as const, label: "필수", value: meeting.requiredAttendees.length ? `${meeting.requiredAttendees.length}명` : "없음" },
    meeting.preferredTime && { field: "preferredTime" as const, label: "선호", value: TIME[meeting.preferredTime] },
    meeting.dateStart && { field: "dateStart" as const, label: "날짜", value: meeting.dateEnd && meeting.dateEnd !== meeting.dateStart ? `${meeting.dateStart.slice(5)} ~ ${meeting.dateEnd.slice(5)}` : meeting.dateStart.slice(5) },
  ].filter(Boolean) as Array<{ field: EditableField; label: string; value: string }>;
  if (!items.length) return null;
  return (
    <section className="completed-conditions" aria-label="정한 조건">
      <p>정한 조건</p>
      <ul>
        {items.map((item) => (
          <li key={item.field}>
            <button type="button" onClick={() => onEdit(item.field)} aria-label={`${item.label} ${item.value} 수정`}>
              <span>{item.label}</span><strong>{item.value}</strong><Pencil aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
