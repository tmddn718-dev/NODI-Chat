export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="NODI">
      <span className="brand-mark">
        <svg viewBox="0 0 100 93" aria-hidden="true">
          <defs>
            <linearGradient id="nodi-l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5FA0FF" /><stop offset="1" stopColor="#1E4FF5" /></linearGradient>
            <linearGradient id="nodi-r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A78BFA" /><stop offset="1" stopColor="#6D4FE8" /></linearGradient>
            <linearGradient id="nodi-d" gradientUnits="userSpaceOnUse" x1="25" y1="20" x2="75" y2="73"><stop offset="0" stopColor="#5E9BFF" /><stop offset="1" stopColor="#4A3FE6" /></linearGradient>
          </defs>
          <rect x="0" y="0" width="33" height="93" rx="16.5" fill="url(#nodi-l)" />
          <rect x="67" y="0" width="33" height="93" rx="16.5" fill="url(#nodi-r)" />
          <path d="M16.5 16.5 83.5 76.5" stroke="url(#nodi-d)" strokeWidth="33" strokeLinecap="round" opacity=".92" />
        </svg>
      </span>
      {!compact && <span className="brand-name">NODI</span>}
    </div>
  );
}
