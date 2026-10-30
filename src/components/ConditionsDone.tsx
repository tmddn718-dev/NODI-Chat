import { Check, ChevronDown } from "lucide-react";
import type { MeetingDraft } from "../types";

// 회의 조건을 다 정한 뒤에는 앞선 질문·답변을 한 줄 요약으로 접어, 지금 해야 할 작업이 위로 보이게 해요.
// 대화를 지우는 게 아니라 눌러서 다시 펼쳐 볼 수 있어요.
export function ConditionsDone({ meeting, hiddenCount, open, onToggle }: { meeting: MeetingDraft; hiddenCount: number; open: boolean; onToggle: () => void }) {
  const attendees = meeting.attendees?.length ?? 0;
  const summary = [meeting.title, meeting.durationMinutes ? `${meeting.durationMinutes}분` : "", attendees ? `참석자 ${attendees}명` : ""].filter(Boolean).join(" · ");
  return (
    <button type="button" className={`cdone ${open ? "open" : ""}`} aria-expanded={open} onClick={onToggle}>
      <span className="cdone-icon" aria-hidden="true"><Check /></span>
      <span className="cdone-copy">
        <strong>회의 조건 설정 완료</strong>
        <small>{summary || "정한 조건을 확인해요"}</small>
        <small className="cdone-hint">{open ? "이전 대화 접기" : `이전 대화 ${hiddenCount}개 보기`}</small>
      </span>
      <ChevronDown className="cdone-chevron" aria-hidden="true" />
    </button>
  );
}
