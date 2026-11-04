import { Info, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MOBILE_QUERY, useMedia } from "../useMedia";

// 후보 간 판단 요소를 같은 순서로 비교해요. 미응답은 불참으로 세지 않고 따로 보여줘요.
// 숫자·추천 이유는 전부 넘겨받은 데이터에서만 만들어요(없는 근거를 지어내지 않아요).
export type CompareColumn = { id: string; label: string; required: string; possible: number; impossible: number; waiting: number; unknown: number; onSelect?: () => void };

// 비교 패널의 실제 너비가 이 값 이상일 때만 가로 비교 표를 써요. 좁으면 세로 후보 카드예요.
const TABLE_MIN_WIDTH = 760;

const requiredText = (column: CompareColumn) => (column.required === "충돌 없음" ? "필수 참석자 일정 충돌 없음" : "필수 참석자 일정 확인 필요");
const ROWS: Array<[string, (column: CompareColumn) => string]> = [
  ["날짜·시간", (column) => column.label],
  ["필수 참석자", requiredText],
  ["참석 가능한 선택 참석자", (column) => `${column.possible}명`],
  ["참석이 어려운 선택 참석자", (column) => `${column.impossible}명`],
  ["아직 응답하지 않은 선택 참석자", (column) => `${column.waiting}명`],
  ["일정 정보 확인 불가", (column) => `${column.unknown}명`],
];

const TIME = /(오전|오후)\s*(\d{1,2}):(\d{2})/;
// "11월 5일 (목) 오후 01:00" → { date: "11월 5일 (목)", clock: "오후 1:00", spoken: "오후 1시" }
export function splitSlot(label: string) {
  const match = label.match(TIME);
  if (!match) return { date: "", clock: label, spoken: label };
  const [whole, half, hour, minute] = match;
  const h = String(Number(hour));
  return { date: label.replace(whole, "").trim(), clock: `${half} ${h}:${minute}`, spoken: minute === "00" ? `${half} ${h}시` : `${half} ${h}시 ${Number(minute)}분` };
}

const metricKey = (column: CompareColumn) => [column.required, column.possible, column.impossible, column.waiting, column.unknown].join("|");
const count = (n: number) => (n === 2 ? "두" : n === 3 ? "세" : "모든");

// 맨 위 후보와 수치가 모두 같은 후보들은 "동일한 수준"으로 묶어요. 수치만으로 순위를 가를 수 없으면 추천이라고 단정하지 않아요.
export function describeColumns(columns: CompareColumn[]) {
  const top = columns[0];
  const tied = top ? columns.filter((column) => metricKey(column) === metricKey(top)) : [];
  const isTied = tied.length > 1;
  const others = columns.filter((column) => !tied.includes(column));
  const badge = (column: CompareColumn) => {
    if (tied.includes(column)) return isTied ? "동일한 수준" : "현재 추천";
    return `다른 후보 ${others.indexOf(column) + 1}`;
  };
  let reason = "";
  if (top) {
    const spoken = tied.map((column) => splitSlot(column.label).spoken);
    if (isTied) {
      const subject = tied.length === 2 ? `${spoken[0]}${/시$/.test(spoken[0]) ? "와" : "과"} ${spoken[1]}` : `상위 ${tied.length}개 후보`;
      reason = `${subject}${tied.length === 2 && !/시$/.test(spoken[1]) ? "은" : "는"} 현재 확인된 필수 참석자 일정과 선택 참석자 응답 현황이 같아요.`;
      if (top.waiting > 0) reason += ` ${count(tied.length)} 시간 모두 선택 참석자 ${top.waiting}명의 응답을 기다리고 있습니다.`;
    } else {
      reason = `${spoken[0]}${/시$/.test(spoken[0]) ? "는" : "은"} ${top.required === "충돌 없음" ? "필수 참석자 일정에 충돌이 없고, " : "필수 참석자 일정 확인이 필요하고, "}현재 확인된 선택 참석자 중 ${top.possible}명이 참석할 수 있어요.`;
      if (others.length && top.possible > Math.max(...others.map((column) => column.possible))) reason += " 다른 후보보다 참석 가능한 인원이 많아요.";
      else if (others.length && top.waiting < Math.min(...others.map((column) => column.waiting))) reason += " 응답을 기다리는 참석자는 가장 적어요.";
    }
  }
  return { tied, isTied, badge, reason };
}

// 모바일: 비교할 후보를 고르면(최대 3개) 아래에 "N개 비교하기"가 나와요. 2개 이상이어야 열려요.
export function CompareBar({ count: picked, onOpen, onClear }: { count: number; onOpen: () => void; onClear: () => void }) {
  return (
    <div className="compare-bar" role="group" aria-label="후보 비교 선택">
      <span className="compare-count">{picked}/3 선택</span>
      {picked > 0 && <button type="button" className="text-link" onClick={onClear}>선택 해제</button>}
      <button type="button" className="rd-btn" disabled={picked < 2} onClick={onOpen}>{picked < 2 ? "2개 이상 선택해 주세요" : `${picked}개 비교하기`}</button>
    </div>
  );
}

const NOTE = "응답 대기는 불참이 아니에요. 응답이 오면 순서가 바뀔 수 있어요.";

function useWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.target.getBoundingClientRect().width));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

export function CompareTable({ columns, onClose }: { columns: CompareColumn[]; onClose?: () => void }) {
  const mobile = useMedia(MOBILE_QUERY);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const busyRef = useRef(false);
  const width = useWidth(panelRef);
  const { tied, isTied, badge, reason } = describeColumns(columns);
  const emphasized = (column: CompareColumn) => !isTied && tied.includes(column); // 동률이면 열·카드를 강조하지 않아요
  const waitingCounts = [...new Set(columns.map((column) => column.waiting))];
  const hasWaiting = columns.some((column) => column.waiting > 0);
  const title = `추천 시간 ${columns.length}개 비교`;

  // 닫으면 비교를 열었던 버튼으로 포커스를 돌려줘요.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => { if (opener && opener.isConnected) opener.focus?.(); };
  }, []);

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

  // 연속 클릭으로 같은 후보가 두 번 선택되지 않게 잠깐 막아요.
  const choose = (column: CompareColumn) => {
    if (busyRef.current || !column.onSelect) return;
    busyRef.current = true;
    window.setTimeout(() => { busyRef.current = false; }, 1200);
    if (mobile) onClose?.();
    column.onSelect();
  };

  const closeButton = onClose && (
    <button type="button" ref={closeRef} className="cmp-close" onClick={onClose} aria-label="비교 접기"><X aria-hidden="true" /></button>
  );
  const intro = (
    <>
      <div className="cmp-head">
        <div><h3 id="cmp-title">{title}</h3><p className="cmp-sub">현재까지 확인된 참석자 응답을 기준으로 비교했어요.</p></div>
        {closeButton}
      </div>
      {hasWaiting && (
        <div className="cmp-notice" role="status">
          <Info aria-hidden="true" />
          <p><strong>아직 응답하지 않은 참석자가 있어요</strong>
            <span>{waitingCounts.length === 1 ? `${waitingCounts[0]}명이 아직 응답하지 않았어요. ` : "후보마다 응답 대기 인원이 달라요. "}새로운 응답에 따라 추천 순위가 달라질 수 있습니다.</span></p>
        </div>
      )}
    </>
  );
  const why = reason && <p className="cmp-reason"><strong>추천 기준</strong> {reason}</p>;
  const cta = (column: CompareColumn) => {
    const spoken = splitSlot(column.label).spoken;
    const primary = tied.includes(column);
    return column.onSelect
      ? <button type="button" className={`cmp-select ${primary ? "primary" : "outline"}`} onClick={() => choose(column)}>{spoken} 선택</button>
      : <button type="button" className="cmp-select outline" disabled aria-label={`${spoken} 선택할 수 없어요. 필수 참석자 일정 확인이 필요해요`}>선택할 수 없어요</button>;
  };

  const cards = columns.map((column) => {
    const { date, clock, spoken } = splitSlot(column.label);
    const top = tied.includes(column);
    const facts = (
      <dl>
        {ROWS.slice(1).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value(column)}</dd></div>)}
      </dl>
    );
    return (
      <section className={`cmp-card ${emphasized(column) ? "top" : ""}`} key={column.id} aria-label={`${badge(column)} ${spoken}`}>
        <p className="cmp-badge">{badge(column)}</p>
        {date && <p className="cmp-date">{date}</p>}
        <p className="cmp-time">{clock}</p>
        {top ? facts : (
          <>
            <p className="cmp-brief">{column.required === "충돌 없음" ? "필수 충돌 없음" : "필수 일정 확인 필요"} · 선택 {column.possible}명 가능<br />참석 불가 {column.impossible}명 · 응답 대기 {column.waiting}명</p>
            <details className="cmp-more"><summary>상세 비교</summary>{facts}</details>
          </>
        )}
        {cta(column)}
      </section>
    );
  });

  if (mobile) {
    return (
      <div className="compare-overlay" role="dialog" aria-modal="true" aria-labelledby="cmp-title">
        <div className="compare-body">
          {intro}
          {why}
          <div className="cmp-cards">{cards}</div>
          <p className="rd-caption">{NOTE}</p>
        </div>
      </div>
    );
  }

  const wide = width === 0 || width >= TABLE_MIN_WIDTH;
  return (
    <section className="compare" aria-labelledby="cmp-title" ref={panelRef}>
      {intro}
      {why}
      {wide ? (
        <div className="compare-scroll" tabIndex={0}>
          <table>
            <thead>
              <tr>
                <th scope="col">비교 기준</th>
                {columns.map((column) => <th scope="col" key={column.id} className={emphasized(column) ? "best" : ""}><span className="cmp-badge">{badge(column)}</span></th>)}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{columns.map((column) => <td key={column.id} className={emphasized(column) ? "best" : ""}>{value(column)}</td>)}</tr>)}
              <tr><th scope="row"><span className="sr-only">선택</span></th>{columns.map((column) => <td key={column.id} className={emphasized(column) ? "best" : ""}>{cta(column)}</td>)}</tr>
            </tbody>
          </table>
        </div>
      ) : <div className="cmp-cards">{cards}</div>}
      <p className="rd-caption">{NOTE}</p>
    </section>
  );
}
