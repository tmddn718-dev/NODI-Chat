// 기기 구분은 CSS 반응형 기준과 같아요: 모바일 ≤767 · 태블릿 768~1199 · 데스크톱 ≥1200.
export type DeviceCategory = "mobile" | "tablet" | "desktop";
export const deviceCategory = (width: number): DeviceCategory => (width <= 767 ? "mobile" : width <= 1199 ? "tablet" : "desktop");

// viewport_bucket: 화면 폭 3구간(기기 구분과는 별개의 보조 값). small < 480 · medium 480~1023 · large ≥ 1024
export type ViewportBucket = "small" | "medium" | "large";
export const viewportBucket = (width: number): ViewportBucket => (width < 480 ? "small" : width < 1024 ? "medium" : "large");

// 세션이 시작될 때 한 번 정해서 고정해요. 화면을 돌리거나 창 크기를 바꿔도 같은 세션의 값이 바뀌지 않아요.
let cached: { device_category: DeviceCategory; viewport_bucket: ViewportBucket } | undefined;
export function deviceInfo() {
  if (cached) return cached;
  try {
    const stored = sessionStorage.getItem("nodi_device");
    if (stored) return (cached = JSON.parse(stored));
  } catch { /* 저장소를 못 쓰는 환경 */ }
  const width = typeof window === "undefined" ? 1280 : window.innerWidth;
  cached = { device_category: deviceCategory(width), viewport_bucket: viewportBucket(width) };
  try { sessionStorage.setItem("nodi_device", JSON.stringify(cached)); } catch { /* 무시 */ }
  return cached;
}
export const resetDeviceForTests = () => { cached = undefined; };
