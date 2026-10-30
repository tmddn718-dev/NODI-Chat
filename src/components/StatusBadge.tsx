import { Check, CircleHelp, Clock, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

// 상태는 색 · 아이콘 · 텍스트를 함께 써요. 일정 충돌 없음과 참석 응답은 다른 상태라서 문구를 따로 둬요.
export type BadgeKind = "ok" | "wait" | "conflict" | "unknown" | "info";
const ICON = { ok: Check, wait: Clock, conflict: TriangleAlert, unknown: CircleHelp, info: Check };

export function StatusBadge({ kind, children }: { kind: BadgeKind; children: ReactNode }) {
  const Icon = ICON[kind];
  return <span className={`sbadge ${kind}`}><Icon aria-hidden="true" />{children}</span>;
}
