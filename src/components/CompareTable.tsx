// 후보 간 판단 요소를 한 표에서 비교해요. 미응답은 불참으로 세지 않고 따로 보여줘요.
export type CompareColumn = { id: string; label: string; required: string; possible: number; impossible: number; waiting: number; unknown: number };

export function CompareTable({ columns, onClose }: { columns: CompareColumn[]; onClose?: () => void }) {
  const rows: Array<[string, (column: CompareColumn) => string]> = [
    ["필수 참석자", (column) => column.required],
    ["선택 참석자 가능", (column) => `${column.possible}명`],
    ["선택 참석자 불가", (column) => `${column.impossible}명`],
    ["선택 참석자 응답 대기", (column) => `${column.waiting}명`],
    ["일정 확인 불가", (column) => `${column.unknown}명`],
  ];
  return (
    <section className="compare" aria-label="추천 시간 비교">
      <div className="compare-head"><h3>추천 시간 비교</h3>{onClose && <button type="button" className="soft-pill" onClick={onClose}>닫기</button>}</div>
      <div className="compare-scroll" tabIndex={0}>
        <table>
          <thead><tr><th scope="col"><span className="sr-only">항목</span></th>{columns.map((column, index) => <th scope="col" key={column.id}>{index === 0 ? "가장 추천 · " : `대안 ${index} · `}{column.label}</th>)}</tr></thead>
          <tbody>{rows.map(([label, value]) => <tr key={label}><th scope="row">{label}</th>{columns.map((column) => <td key={column.id}>{value(column)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <p className="rd-caption">응답 대기는 불참이 아니에요. 응답이 오면 순서가 바뀔 수 있어요.</p>
    </section>
  );
}
