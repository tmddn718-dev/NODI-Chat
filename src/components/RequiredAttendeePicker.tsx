import { Check, CircleUser, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { NodiMark } from "./NodiMark";

const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export function RequiredAttendeePicker({ attendees, language, onConfirm }: {
  attendees: string[];
  language: "ko" | "en";
  onConfirm: (requiredAttendees: string[]) => void;
  onDirectInput?: () => void;
}) {
  const ko = language === "ko";
  const [selected, setSelected] = useState<string[]>([]);
  const [manual, setManual] = useState<string | null>(null);
  const [manualError, setManualError] = useState("");

  // 이름(일부만 써도 돼요)을 쉼표로 구분해 입력하면 참석자 목록에서 찾아 꼭 참석으로 표시해요. 목록에 없는 이름은 알려 줘요.
  function applyManual() {
    const tokens = (manual ?? "").split(/[,\n]/).map((item) => item.trim().toLocaleLowerCase()).filter(Boolean);
    if (!tokens.length) return;
    const found: string[] = [];
    const missing: string[] = [];
    for (const token of tokens) {
      const exact = attendees.find((name) => name.toLocaleLowerCase() === token);
      const partial = attendees.filter((name) => name.toLocaleLowerCase().includes(token));
      const match = exact ?? (partial.length === 1 ? partial[0] : undefined);
      if (match) found.push(match); else missing.push(token);
    }
    if (missing.length) {
      setManualError(ko ? `${missing.join(", ")}은(는) 참석자 목록에서 찾을 수 없거나 여러 명이에요. 이름을 조금 더 정확히 써 주세요.` : `Could not match: ${missing.join(", ")}.`);
      return;
    }
    setSelected((current) => [...new Set([...current, ...found])]);
    setManual(null);
    setManualError("");
  }

  function toggle(attendee: string) {
    setSelected((current) => current.includes(attendee) ? current.filter((item) => item !== attendee) : [...current, attendee]);
  }

  return (
    <section className="required-picker" aria-labelledby="required-picker-title">
      <div className="guided-heading">
        <span className="heading-logo"><NodiMark /></span>
        <div><p>2 / 6{ko ? "단계 · 참석자와 우선순위" : " · Availability rule"}</p><h2 id="required-picker-title">{ko ? "누가 꼭 참석해야 하나요?" : "Whose availability is required?"}</h2></div>
      </div>
      <progress className="guided-progress" max="6" value="2" aria-label={ko ? "6단계 중 2단계" : "Step 2 of 6"} />

      <div className="required-toolbar">
        <p>{ko ? "꼭 참석할 사람이 가능한 시간만 추천해요. 나머지는 참여하면 좋은 사람으로, 가능한 사람이 많은 순서에 반영해요." : "Only slots that work for everyone selected here can be confirmed."}</p>
        <div><button onClick={() => setSelected(attendees)}>{ko ? "모두 선택" : "Select all"}</button><button onClick={() => setSelected([])}>{ko ? "선택 해제" : "Clear"}</button></div>
      </div>

      <div className="required-people" role="group" aria-label={ko ? "꼭 참석할 사람" : "Required attendees"}>
        {attendees.map((attendee) => {
          const checked = selected.includes(attendee);
          return (
            <button key={attendee} className={checked ? "selected" : ""} onClick={() => toggle(attendee)} aria-pressed={checked}>
              <span className="person-avatar" aria-hidden="true">{attendee.includes("@") ? "@" : initials(attendee)}</span>
              <span><strong>{attendee}</strong><small>{checked ? (ko ? "꼭 참석해요 · 이 사람이 가능한 시간만 추천해요" : "Availability required") : (ko ? "참여하면 좋은 사람 · 눌러서 꼭 참석으로 바꿔요" : "Select to make required")}</small></span>
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
      {manual === null ? (
        <button className="direct-input-button" onClick={() => setManual("")}>{ko ? "직접 알려주기" : "Describe the rule instead"}</button>
      ) : (
        <form className="direct-form" onSubmit={(event) => { event.preventDefault(); applyManual(); }}>
          <input className="rd-input" autoFocus aria-label={ko ? "꼭 참석할 사람 직접 입력" : "Required attendees"} placeholder={ko ? "꼭 참석할 분의 이름을 쉼표로 구분해 입력해 주세요" : "Names, separated by commas"} value={manual} onChange={(event) => { setManual(event.target.value); setManualError(""); }} />
          {manualError && <p className="dialog-error" role="alert">{manualError}</p>}
          <div className="direct-actions">
            <button type="button" className="secondary-button" onClick={() => { setManual(null); setManualError(""); }}>{ko ? "취소" : "Cancel"}</button>
            <button type="submit" className="primary-button" disabled={!manual.trim()}>{ko ? "적용" : "Apply"}</button>
          </div>
        </form>
      )}
    </section>
  );
}
