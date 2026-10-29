import { STAGE_TITLES, stageOf, type GuidedChoice, type GuidedStep } from "../guided";
import { NodiMark } from "./NodiMark";

export function GuidedChoices({
  step,
  onSelect,
  onDirectInput,
  recommended,
}: {
  step: GuidedStep;
  onSelect: (choice: GuidedChoice) => void;
  onDirectInput?: (placeholder: string) => void;
  recommended?: string;
}) {
  const stage = stageOf(step.key);
  return (
    <section className="guided-card" aria-labelledby={`guided-${step.key}`}>
      <div className="guided-heading">
        <span className="heading-logo"><NodiMark /></span>
        <div>
          <p>{STAGE_TITLES[stage - 1]}</p>
          <h2 id={`guided-${step.key}`}>{step.question}</h2>
        </div>
      </div>
      <div className="guided-options" aria-label={`${step.title} 추천 목록`}>
        {step.choices.map((choice) => (
          <button key={choice.label} className={choice.label === recommended ? "recommended" : undefined} onClick={() => onSelect(choice)}>
            {choice.label === recommended && <span className="reco-tip">추천</span>}{choice.label}
          </button>
        ))}
      </div>
      {step.hint && <p className="guided-hint">{step.hint}</p>}
      <div className="choice-divider"><span>직접 알려주고 싶다면</span></div>
      <button className="direct-input-button" onClick={() => onDirectInput?.(step.inputPlaceholder)}>
        직접 입력할게요
      </button>
    </section>
  );
}
