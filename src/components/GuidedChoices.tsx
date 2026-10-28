import { ListChecks } from "lucide-react";
import { STAGE_TITLES, STAGE_TOTAL, stageOf, type GuidedChoice, type GuidedStep } from "../guided";

export function GuidedChoices({
  step,
  onSelect,
  onDirectInput,
}: {
  step: GuidedStep;
  onSelect: (choice: GuidedChoice) => void;
  onDirectInput: (placeholder: string) => void;
}) {
  const stage = stageOf(step.key);
  return (
    <section className="guided-card" aria-labelledby={`guided-${step.key}`}>
      <div className="guided-heading">
        <span><ListChecks /></span>
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
      <button className="direct-input-button" onClick={() => onDirectInput(step.inputPlaceholder)}>
        직접 입력할게요
      </button>
    </section>
  );
}
