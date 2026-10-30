import { PROTOTYPE, type ExperimentVariant } from "./prototype";

// 익명 ID로 실험군을 결정론적으로 정해요: 같은 ID는 새로고침해도 같은 군이에요. 실험이 없으면 "none"이에요.
function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function experimentVariant(anonymousId: string, experiment: { id: string; variants: readonly ExperimentVariant[] } = PROTOTYPE.experiment): ExperimentVariant {
  if (!experiment.variants.length) return "none";
  return experiment.variants[hash(`${experiment.id}:${anonymousId}`) % experiment.variants.length];
}
