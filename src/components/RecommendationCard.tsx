import { ChevronDown, Check, Clock, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { clockLabel, minutesBetween, slotLabel } from "../format";
import { StatusBadge, type BadgeKind } from "./StatusBadge";
import { splitSlot } from "./CompareTable";

export type ReasonLine = { kind: "ok" | "wait" | "warn" | "plain"; text: string };
const ICON = { ok: Check, wait: Clock, warn: TriangleAlert } as const;

// 추천 카드: 시간(가장 크게) → 상태 → 추천 이유 → 남은 불확실성 → 세부 정보(펼침) → 행동. 웹·모바일이 같은 순서예요.
export function RecommendationCard({ label, top, start, end, badge, reasons, details, canSelect, onSelect, ctaLabel, disabledLabel = "확정 검토 불가", compare, compact }: {
  label: string;
  top?: boolean;
  start: string;
  end: string;
  badge: { kind: BadgeKind; text: string };
  reasons: ReasonLine[];
  details?: ReactNode;
  canSelect: boolean;
  onSelect: () => void;
  ctaLabel?: string;
  disabledLabel?: string;
  compare?: { checked: boolean; disabled: boolean; onToggle: () => void };
  // 모바일 압축 리스트: 처음에는 순위·시간·한 줄 요약만 보여주고, 눌러야 추천 이유·세부 정보·행동이 펼쳐져요.
  compact?: { summary: string; detail?: string };
}) {
  const [open, setOpen] = useState(false);
  // 버튼에 고른 시간을 넣어요. 누르면 확정이 아니라 확정 전 검토 단계로 가요.
  const cta = ctaLabel ?? `${splitSlot(slotLabel(start)).spoken} 선택하기`;
  if (compact && !open) {
    return (
      <li className={`rcard rcard-compact ${top ? "top" : ""}`}>
        <button type="button" className="rcard-row" aria-expanded="false" onClick={() => setOpen(true)}>
          <span className={`rcard-rank ${top ? "best" : ""}`}>{label}</span>
          <span className="rcard-row-copy"><strong>{slotLabel(start)}</strong><small>{minutesBetween(start, end)}분 · {compact.summary}</small>{compact.detail && <small>{compact.detail}</small>}</span>
          <ChevronDown aria-hidden="true" />
        </button>
      </li>
    );
  }
  return (
    <li className={`rcard ${top ? "top" : ""}`}>
      {compact && <button type="button" className="rcard-collapse" aria-expanded="true" onClick={() => setOpen(false)}>접기<ChevronDown aria-hidden="true" className="up" /></button>}
      <div className="rcard-top">
        <StatusBadge kind={badge.kind}>{badge.text}</StatusBadge>
        <span className={`rcard-rank ${top ? "best" : ""}`}>{label}</span>
      </div>
      <p className="rcard-time">{slotLabel(start)}</p>
      <p className="rcard-sub">{clockLabel(start)} ~ {clockLabel(end)} · {minutesBetween(start, end)}분 · Asia/Seoul</p>
      <hr className="rcard-rule" />
      <p className="rcard-why">이 시간을 추천하는 이유</p>
      <ul className="rcard-lines">
        {reasons.map((reason) => {
          const Icon = reason.kind === "plain" ? null : ICON[reason.kind];
          return <li key={reason.text} className={reason.kind}>{Icon ? <Icon aria-hidden="true" /> : <span className="rcard-gap" aria-hidden="true" />}<span>{reason.text}</span></li>;
        })}
      </ul>
      {details && (
        <details className="rcard-more">
          <summary>참석 가능 여부 자세히 <ChevronDown aria-hidden="true" /></summary>
          <div className="rcard-detail">{details}</div>
        </details>
      )}
      {compare && (
        <button type="button" className={`rcard-compare ${compare.checked ? "on" : ""}`} aria-pressed={compare.checked} disabled={compare.disabled && !compare.checked} onClick={compare.onToggle}>
          <span className="rcard-check" aria-hidden="true">{compare.checked && <Check />}</span>비교에 추가
        </button>
      )}
      <button type="button" className="rd-btn rcard-cta" disabled={!canSelect} onClick={onSelect} aria-label={canSelect ? `${cta} (확정 전 검토 단계로 이동)` : undefined}>{canSelect ? cta : disabledLabel}</button>
    </li>
  );
}
