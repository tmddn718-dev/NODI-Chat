import { useEffect, useState } from "react";

// 반응형 기준: 모바일 ≤767px · 태블릿 768~1199px · 데스크톱 ≥1200px (styles.css의 미디어 쿼리와 같은 값)
export const MOBILE_QUERY = "(max-width: 767px)";

export function useMedia(query: string) {
  const supported = typeof window !== "undefined" && typeof window.matchMedia === "function";
  const [matches, setMatches] = useState(() => (supported ? window.matchMedia(query).matches : false));
  useEffect(() => {
    if (!supported) return;
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query, supported]);
  return matches;
}
