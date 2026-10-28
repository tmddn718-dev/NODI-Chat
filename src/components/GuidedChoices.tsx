import { useState, type FormEvent } from "react";
import { STAGE_TITLES, STAGE_TOTAL, stageOf, type GuidedChoice, type GuidedStep } from "../guided";
import { NodiMark } from "./NodiMark";

export function GuidedChoices({
  step,
  onSelect,
  onDirectInput,
  language = "ko",
}: {
  step: GuidedStep;
  onSelect: (choice: GuidedChoice) => void;
  onDirectInput?: (placeholder: string) => void;
  language?: "ko" | "en";
}) {
  const ko = language === "ko";
  const stage = stageOf(step.key);
  const [custom, setCustom] = useState(false);
  const [value, setValue] = useState("");
  const numeric = step.key === "duration";
  // 회의 종류·목적·시간은 카드 안에서 바로 입력하고, 그 밖의 단계(선호 시간대 등)는 채팅 입력창으로 안내해요.
  const structured = step.key === "title" || step.key === "purpose" || step.key === "duration";
  const text = value.trim();
  const minutes = Number(text);
  const valid = numeric ? Number.isInteger(minutes) && minutes >= 5 && minutes <= 480 : text.length > 0;

  // 직접 입력한 값도 추천 버튼을 눌렀을 때와 같은 경로(selectGuidedChoice)로 보내서 다음 단계로 이어져요.
  function submitCustom(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    if (step.key === "title") onSelect({ label: text, message: ko ? `회의 종류는 ${text}야.` : `The meeting type is ${text}.`, patch: { title: text } });
    else if (step.key === "purpose") onSelect({ label: text, message: ko ? `회의 목적은 ${text}야.` : `The meeting purpose is ${text}.`, patch: { purpose: text } });
    else if (step.key === "duration") onSelect({ label: ko ? `${minutes}분` : `${minutes} min`, message: ko ? `회의 시간은 ${minutes}분으로 할게.` : `Set the meeting duration to ${minutes} minutes.`, patch: { durationMinutes: minutes } });
    setValue(""); setCustom(false);
  }
  return (
    <section className="guided-card" aria-labelledby={`guided-${step.key}`}>
      <div className="guided-heading">
        <span className="heading-logo"><NodiMark /></span>
        <div>
          <p>{stage} / {STAGE_TOTAL}단계 · {STAGE_TITLES[stage - 1]}</p>
          <h2 id={`guided-${step.key}`}>{step.question}</h2>
        </div>
      </div>
      <div className="guided-progress-row">
        <progress className="guided-progress" max={STAGE_TOTAL} value={stage} aria-label={`${STAGE_TOTAL}단계 중 ${stage}단계`} />
        <span>{stage}/{STAGE_TOTAL}</span>
      </div>
      <div className="guided-options" aria-label={`${step.title} 추천 목록`}>
        {step.choices.map((choice) => (
          <button key={choice.label} onClick={() => onSelect(choice)}>
            {choice.label}
          </button>
        ))}
      </div>
      <div className="choice-divider"><span>직접 알려주고 싶다면</span></div>
      {custom && structured ? (
        <form className="direct-form" onSubmit={submitCustom}>
          <div className="direct-field">
            <input className="rd-input" autoFocus aria-label={`${step.title} 직접 입력`} placeholder={step.inputPlaceholder} value={value} maxLength={numeric ? 3 : 60}
              inputMode={numeric ? "numeric" : "text"} onChange={(event) => setValue(numeric ? event.target.value.replace(/\D/g, "") : event.target.value)} />
            {numeric && <span className="direct-unit">분</span>}
          </div>
          {numeric && value && !valid && <p className="rd-caption">5분부터 480분(8시간)까지 입력할 수 있어요.</p>}
          <div className="direct-actions">
            <button type="button" className="secondary-button" onClick={() => { setCustom(false); setValue(""); }}>취소</button>
            <button type="submit" className="primary-button" disabled={!valid}>확인</button>
          </div>
        </form>
      ) : (
        <button className="direct-input-button" onClick={() => (structured ? setCustom(true) : onDirectInput?.(step.inputPlaceholder))}>
          직접 입력할게요
        </button>
      )}
    </section>
  );
}
