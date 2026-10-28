import { Check, CircleUser, ShieldCheck } from "lucide-react";
import { useState } from "react";

const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export function RequiredAttendeePicker({ attendees, language, onConfirm, onDirectInput }: {
  attendees: string[];
  language: "ko" | "en";
  onConfirm: (requiredAttendees: string[]) => void;
  onDirectInput: () => void;
}) {
  const ko = language === "ko";
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(attendee: string) {
    setSelected((current) => current.includes(attendee) ? current.filter((item) => item !== attendee) : [...current, attendee]);
  }

  return (
    <section className="required-picker" aria-labelledby="required-picker-title">
      <div className="guided-heading">
        <span><ShieldCheck /></span>
        <div><p>5 / 8 · {ko ? "꼭 참석할 사람" : "Availability rule"}</p><h2 id="required-picker-title">{ko ? "누가 꼭 참석해야 하나요?" : "Whose availability is required?"}</h2></div>
      </div>
      <progress className="guided-progress" max="8" value="5" aria-label={ko ? "8단계 중 5단계" : "Step 5 of 8"} />

      <div className="required-toolbar">
        <p>{ko ? "선택한 사람이 모두 가능한 시간만 보여드려요." : "Only slots that work for everyone selected here can be confirmed."}</p>
        <div><button onClick={() => setSelected(attendees)}>{ko ? "모두 선택" : "Select all"}</button><button onClick={() => setSelected([])}>{ko ? "선택 해제" : "Clear"}</button></div>
      </div>

      <div className="required-people" role="group" aria-label={ko ? "꼭 참석할 사람" : "Required attendees"}>
        {attendees.map((attendee) => {
          const checked = selected.includes(attendee);
          return (
            <button key={attendee} className={checked ? "selected" : ""} onClick={() => toggle(attendee)} aria-pressed={checked}>
              <span className="person-avatar" aria-hidden="true">{attendee.includes("@") ? "@" : initials(attendee)}</span>
              <span><strong>{attendee}</strong><small>{checked ? (ko ? "꼭 참석해요" : "Availability required") : (ko ? "누르면 꼭 참석할 사람으로 정해요" : "Select to make required")}</small></span>
              <i aria-hidden="true">{checked ? <Check /> : <CircleUser />}</i>
            </button>
          );
        })}
      </div>

      <div className="required-selection-summary" aria-live="polite">
        <span>{selected.length ? <ShieldCheck /> : <CircleUser />}</span>
        <p><strong>{selected.length ? (ko ? `${selected.length}명이 꼭 참석해요` : `${selected.length} required`) : (ko ? "꼭 참석할 사람은 없어요" : "No required attendees")}</strong><small>{selected.length ? selected.join(", ") : (ko ? "답변과 캘린더를 바탕으로 시간을 찾아드려요." : "Recommendations will use confirmed availability only.")}</small></p>
      </div>

      <button className="primary-button required-confirm" onClick={() => onConfirm(selected)}>{selected.length ? (ko ? "이대로 계속" : "Continue with this rule") : (ko ? "건너뛰기" : "Continue without a required attendee")}</button>
      <button className="direct-input-button" onClick={onDirectInput}>{ko ? "직접 알려주기" : "Describe the rule instead"}</button>
    </section>
  );
}
