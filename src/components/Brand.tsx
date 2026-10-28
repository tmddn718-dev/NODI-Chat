import { NodiMark } from "./NodiMark";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className="brand" href="/" aria-label="NODI 처음 화면으로">
      <span className="brand-mark"><NodiMark /></span>
      {!compact && <span className="brand-name">NODI</span>}
    </a>
  );
}
