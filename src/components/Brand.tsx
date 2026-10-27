import { CalendarCheck } from "@phosphor-icons/react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="NODI">
      <span className="brand-mark"><CalendarCheck weight="bold" /></span>
      {!compact && <span className="brand-name">NODI</span>}
    </div>
  );
}
