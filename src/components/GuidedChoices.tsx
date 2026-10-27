import { Check, ListChecks, PencilSimple } from "@phosphor-icons/react";
import type { GuidedChoice, GuidedStep } from "../guided";

export function GuidedChoices({
  step,
  onSelect,
  onDirectInput,
}: {
  step: GuidedStep;
  onSelect: (choice: GuidedChoice) => void;
  onDirectInput: (placeholder: string) => void;
}) {
  return (
    <section className="guided-card" aria-labelledby={`guided-${step.key}`}>
      <div className="guided-heading">
        <span><ListChecks weight="duotone" /></span>
        <div>
          <p>{step.number} / {step.total} · {step.title}</p>
          <h2 id={`guided-${step.key}`}>{step.question}</h2>
        </div>
      </div>
      <progress className="guided-progress" max={step.total} value={step.number} aria-label={`${step.total}단계 중 ${step.number}단계`} />
      <div className="guided-options" aria-label={`${step.title} 추천 목록`}>
        {step.choices.map((choice) => (
          <button key={choice.label} onClick={() => onSelect(choice)}>
            <Check weight="bold" /> {choice.label}
          </button>
        ))}
      </div>
      <div className="choice-divider"><span>직접 알려주고 싶다면</span></div>
      <button className="direct-input-button" onClick={() => onDirectInput(step.inputPlaceholder)}>
        <PencilSimple /> 직접 입력할게요
      </button>
    </section>
  );
}
