import { ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import { MOBILE_QUERY, useMedia } from "../useMedia";

// 후보 간 판단 요소를 같은 순서로 비교해요. 미응답은 불참으로 세지 않고 따로 보여줘요.
export type CompareColumn = { id: string; label: string; required: string; possible: number; impossible: number; waiting: number; unknown: number; onSelect?: () => void };

const ROWS: Array<[string, (column: CompareColumn) => string]> = [
  ["필수 참석자", (column) => column.required],
  ["선택 참석자 가능", (column) => `${column.possible}명`],
  ["선택 참석자 불가", (column) => `${column.impossible}명`],
  ["선택 참석자 응답 대기", (column) => `${column.waiting}명`],
  ["일정 확인 불가", (column) => `${column.unknown}명`],
];
const rank = (index: number) => (index === 0 ? "가장 추천" : `대안 ${index}`);
const NOTE = "응답 대기는 불참이 아니에요. 응답이 오면 순서가 바뀔 수 있어요.";

export function CompareTable({ columns, onClose }: { columns: CompareColumn[]; onClose?: () => void }) {
  const mobile = useMedia(MOBILE_QUERY);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 모바일은 전체 화면으로 열어요: 후보를 세로 카드로 보여주고, 배경 스크롤은 잠가요.
  useEffect(() => {
    if (!mobile) return;
    closeRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", onKey); };
  }, [mobile, onClose]);

  if (mobile) {
    return (
      <div className="compare-overlay" role="dialog" aria-modal="true" aria-label="추천 시간 비교">
        <header>
          <button type="button" ref={closeRef} className="icon-button" onClick={onClose} aria-label="비교 닫기"><ArrowLeft /></button>
          <h3>추천 시간 비교</h3>
        </header>
        <div className="compare-body">
          {columns.map((column, index) => (
            <section className="compare-card" key={column.id} aria-label={`${rank(index)} ${column.label}`}>
              <p className="compare-rank">{rank(index)}</p>
              <h4>{column.label}</h4>
              <dl>{ROWS.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value(column)}</dd></div>)}</dl>
              {column.onSelect && <button type="button" className="rd-btn m" onClick={() => { onClose?.(); column.onSelect!(); }}>이 시간 선택</button>}
            </section>
          ))}
          <p className="rd-caption">{NOTE}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="compare" aria-label="추천 시간 비교">
      <div className="compare-head"><h3>추천 시간 비교</h3>{onClose && <button type="button" className="soft-pill" onClick={onClose}>닫기</button>}</div>
      <div className="compare-scroll" tabIndex={0}>
        <table>
          <thead><tr><th scope="col"><span className="sr-only">항목</span></th>{columns.map((column, index) => <th scope="col" key={column.id}>{rank(index)} · {column.label}</th>)}</tr></thead>
          <tbody>
            {ROWS.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{columns.map((column) => <td key={column.id}>{value(column)}</td>)}</tr>)}
            {columns.some((column) => column.onSelect) && <tr><th scope="row"><span className="sr-only">선택</span></th>{columns.map((column) => <td key={column.id}>{column.onSelect && <button type="button" className="soft-pill" onClick={column.onSelect}>선택</button>}</td>)}</tr>}
          </tbody>
        </table>
      </div>
      <p className="rd-caption">{NOTE}</p>
    </section>
  );
}
