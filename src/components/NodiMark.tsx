import { useId } from "react";

// NODI 심볼: 모여드는 시간의 흐름을 원형으로 표현한 링 + 위쪽 오른쪽의 작은 점
export function NodiMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} viewBox="0 0 304 288" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-ring`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#B8A4FF" /><stop offset=".45" stopColor="#6D5CF0" /><stop offset="1" stopColor="#2E5CF5" />
        </linearGradient>
        <linearGradient id={`${id}-swirl`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#C9B9FF" /><stop offset="1" stopColor="#8F86F5" />
        </linearGradient>
        <linearGradient id={`${id}-dot`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4A86FF" /><stop offset="1" stopColor="#2F55E8" />
        </linearGradient>
        <clipPath id={`${id}-clip`}><path fillRule="evenodd" d="M144 0a144 144 0 1 0 0 288a144 144 0 1 0 0-288zm0 75a69 69 0 1 1 0 138a69 69 0 1 1 0-138z" /></clipPath>
        <mask id={`${id}-cut`} maskUnits="userSpaceOnUse" x="0" y="0" width="304" height="288">
          <rect width="304" height="288" fill="#fff" /><circle cx="268" cy="56" r="52" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${id}-cut)`}>
        <g clipPath={`url(#${id}-clip)`}>
          <rect width="288" height="288" fill={`url(#${id}-ring)`} />
          <ellipse cx="82" cy="182" rx="104" ry="64" transform="rotate(38 82 182)" fill={`url(#${id}-swirl)`} opacity=".75" />
        </g>
      </g>
      <circle cx="268" cy="56" r="36" fill={`url(#${id}-dot)`} />
    </svg>
  );
}
