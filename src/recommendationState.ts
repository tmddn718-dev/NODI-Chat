import type { BadgeKind } from "./components/StatusBadge";

// 추천 후보의 상태 체계: 확정 검토 가능 / 응답 대기 / 조건 충돌 / 참고 후보.
// "추천이 있다"와 "확정할 수 있다"를 섞어 쓰지 않도록, 필수 참석자 조건으로만 확정 검토 가능 여부를 정해요.
// 선택 참석자의 미응답은 확정을 막지 않지만, 카드 안의 "응답 대기" 줄로 불확실성을 보여줘요.
export type RecState = { badge: { kind: BadgeKind; text: string }; canSelect: boolean };

export function recommendationState({ requiredOk, requiredConflict, optionalConflict, index }: {
  requiredOk: boolean;
  requiredConflict: boolean;
  optionalConflict: number;
  index: number;
}): RecState {
  if (requiredOk) {
    return optionalConflict > 0 && index > 0
      ? { badge: { kind: "neutral", text: "참고 후보" }, canSelect: true }
      : { badge: { kind: "info", text: "확정 검토 가능" }, canSelect: true };
  }
  return requiredConflict
    ? { badge: { kind: "conflict", text: "조건 충돌" }, canSelect: false }
    : { badge: { kind: "wait", text: "응답 대기" }, canSelect: false };
}
