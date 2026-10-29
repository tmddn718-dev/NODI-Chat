import { Check, Lightbulb, Users } from "lucide-react";
import type { MeetingDraft } from "../types";

export type FieldKey = "title" | "purpose" | "durationMinutes" | "attendees" | "requiredAttendees" | "preferredTime" | "dateStart" | "dateEnd";
export type Understood = { changed: Array<{ field: FieldKey; before?: string; beforeValue?: MeetingDraft[FieldKey]; after: string }>; issues: string[] };

const LABEL: Record<FieldKey, string> = { title: "회의 종류", purpose: "목적", durationMinutes: "시간", attendees: "참석자", requiredAttendees: "꼭 참석", preferredTime: "선호 시간", dateStart: "시작일", dateEnd: "종료일" };
const TIME = { morning: "오전", afternoon: "오후", any: "시간대 무관" };

export const fieldLabel = (field: FieldKey) => LABEL[field];
export function fieldText(field: FieldKey, value: MeetingDraft[FieldKey]): string {
  if (value === undefined || value === null) return "";
  if (field === "durationMinutes") return `${value}분`;
  if (field === "preferredTime") return TIME[value as keyof typeof TIME] ?? String(value);
  if (Array.isArray(value)) return value.length ? value.join(", ") : "없음";
  return String(value);
}

// 직접 입력 직후 "이렇게 이해했어요": 새로 파악하거나 바뀐 조건만 토스식 행(왼쪽 라벨 · 오른쪽 값)으로 보여주고, 틀리면 한 번에 되돌려요.
export function UnderstoodConditionsCard({ understood, onRevert }: { understood: Understood; onRevert?: (field: FieldKey) => void }) {
  if (!understood.changed.length && !understood.issues.length) return null;
  return (
    <section className="understood-card" aria-label="이렇게 이해했어요">
      <p className="understood-title"><Check aria-hidden="true" />이렇게 이해했어요</p>
      <ul>
        {understood.changed.map((item) => (
          <li key={item.field}>
            <span className="understood-label">{LABEL[item.field]}</span>
            <span className="understood-value">
              <strong>{item.before ? <><s>{item.before}</s> → {item.after}</> : item.after}</strong>
              {onRevert && <button type="button" className="soft-pill" onClick={() => onRevert(item.field)} aria-label={`${LABEL[item.field]} 되돌리기`}>되돌리기</button>}
            </span>
          </li>
        ))}
      </ul>
      {understood.issues.map((issue) => <p key={issue} className="understood-issue" role="note">{issue}</p>)}
    </section>
  );
}

// NODI 추천은 확정이 아니에요. 큰 값 + 이유 + 한 번의 동의로 반영하고, 다른 값도 바로 고를 수 있어요.
export function ProposalConfirmCard({ field, value, reason, alternatives, onAccept, onDecline, onAlternative }: { field: FieldKey; value: MeetingDraft[FieldKey]; reason?: string; alternatives?: number[]; onAccept: () => void; onDecline: () => void; onAlternative?: (minutes: number) => void }) {
  return (
    <section className="proposal-card" aria-label="제안 확인">
      <p className="understood-title"><Lightbulb aria-hidden="true" />NODI 추천 · {LABEL[field]} <em className="unconfirmed">확인 전</em></p>
      <strong className="proposal-value">{fieldText(field, value)}</strong>
      <p className="proposal-reason">{reason ?? "아직 정해진 값이 아니에요. 동의하면 반영해요."}</p>
      {!!alternatives?.length && onAlternative && (
        <div className="proposal-alts" role="group" aria-label="다른 시간">
          {alternatives.map((minutes) => <button key={minutes} type="button" className="pick-chip" onClick={() => onAlternative(minutes)}>{minutes}분</button>)}
        </div>
      )}
      <div className="proposal-actions">
        <button type="button" className="primary-button" onClick={onAccept}><Check aria-hidden="true" />이대로 할게요</button>
        <button type="button" className="text-link" onClick={onDecline}>직접 입력할게요</button>
      </div>
    </section>
  );
}

// 모호한 입력은 오류가 아니에요. 가능한 해석 2~4개를 보여주고, 한 번의 선택으로 구체화해요. 직접 입력도 항상 있어요.
export function AmbiguityResolver({ title = "누구를 말씀하신 건가요?", options, onPick, onDirect }: { title?: string; options: Array<{ id: string; label: string }>; onPick: (id: string) => void; onDirect?: () => void }) {
  return (
    <section className="proposal-card" aria-label="해석 선택">
      <p className="understood-title"><Users aria-hidden="true" />{title}</p>
      <div className="guided-options">
        {options.map((option) => <button key={option.id} type="button" onClick={() => onPick(option.id)}>{option.label}</button>)}
      </div>
      {onDirect && <button type="button" className="direct-input-button" onClick={onDirect}>직접 입력할게요</button>}
    </section>
  );
}
