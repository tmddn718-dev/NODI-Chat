import { PROTOTYPE } from "./prototype";

// 분석 동의 상태와 익명 ID. 동의하기 전에는 익명 ID도 만들지 않아요.
// 세션 리플레이는 이 버전에서 수집하지 않아서 replay는 항상 false예요(구조만 분리해 둠).
export type Consent = { policyVersion: string; analytics: boolean; replay: false; decidedAt: string };
const CONSENT_KEY = "nodi_consent";
const ANON_KEY = "nodi_anon_id";
const listeners = new Set<() => void>();

function read(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function write(key: string, value: string | null) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* 저장소를 못 쓰는 환경 */ } }

// 정책 버전이 바뀌었으면 이전 선택은 무효로 보고 다시 물어요.
export function readConsent(): Consent | null {
  const raw = read(CONSENT_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Consent;
    return value.policyVersion === PROTOTYPE.consentPolicyVersion && typeof value.analytics === "boolean" ? value : null;
  } catch { return null; }
}

export function writeConsent(analytics: boolean): Consent {
  const next: Consent = { policyVersion: PROTOTYPE.consentPolicyVersion, analytics, replay: false, decidedAt: new Date().toISOString() };
  write(CONSENT_KEY, JSON.stringify(next));
  // 철회하면 익명 ID를 지워요. 다시 동의하면 새 ID가 만들어져서 이전 기록과 이어지지 않아요.
  if (!analytics) write(ANON_KEY, null);
  listeners.forEach((listener) => listener());
  return next;
}

// 동의한 경우에만 만들고 저장해요. 수명: 철회하거나 브라우저 저장소를 지울 때까지.
export function anonymousId(): string | null {
  if (readConsent()?.analytics !== true) return null;
  const existing = read(ANON_KEY);
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
  const id = crypto.randomUUID();
  write(ANON_KEY, id);
  return id;
}

export function subscribeConsent(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
