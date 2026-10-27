import { Eye, EyeSlash, Key, LockKey, ShieldCheck } from "@phosphor-icons/react";
import { type FormEvent, useState } from "react";
import { Brand } from "./Brand";

type Props = {
  onConnect: (key: string) => Promise<void>;
};

export function ConnectScreen({ onConnect }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!apiKey.trim()) return;
    setStatus("loading");
    setError("");
    try {
      await onConnect(apiKey.trim());
      setApiKey("");
      setStatus("success");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "연결에 실패했습니다.");
      setStatus("error");
    }
  }

  return (
    <main className="connect-shell">
      <section className="connect-intro">
        <Brand />
        <div className="intro-copy">
          <p className="overline">MEETING COORDINATOR</p>
          <h1>대화만 하면,<br />회의 시간이 정리됩니다.</h1>
          <p>참석자 일정과 선호 조건을 확인하고, 설명 가능한 후보 시간을 제안합니다.</p>
        </div>
        <div className="trust-note">
          <ShieldCheck size={24} weight="duotone" />
          <span>API Key는 브라우저나 데이터베이스에 저장하지 않습니다.</span>
        </div>
      </section>

      <section className="connect-panel" aria-labelledby="connect-title">
        <div className="connect-card">
          <span className="key-icon"><Key size={26} weight="duotone" /></span>
          <h2 id="connect-title">Groq 연결</h2>
          <p className="muted">AI 회의 도우미를 시작하려면 Groq API Key를 연결해 주세요.</p>
          <form onSubmit={submit}>
            <label htmlFor="api-key">Groq API Key</label>
            <div className={`input-with-action ${status === "error" ? "field-error" : ""}`}>
              <LockKey size={19} aria-hidden="true" />
              <input
                id="api-key"
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="gsk_..."
                autoComplete="off"
                aria-describedby="key-help"
                disabled={status === "loading"}
              />
              <button type="button" className="icon-button" onClick={() => setShowKey((value) => !value)} aria-label={showKey ? "API Key 숨기기" : "API Key 보기"}>
                {showKey ? <EyeSlash /> : <Eye />}
              </button>
            </div>
            <p id="key-help" className={status === "error" ? "error-text" : "helper-text"} role={status === "error" ? "alert" : undefined}>
              {error || "Key는 서버의 임시 메모리 세션에만 보관됩니다."}
            </p>
            <button className="primary-button connect-button" disabled={!apiKey.trim() || status === "loading"}>
              {status === "loading" ? "연결 확인 중..." : "연결 테스트하고 시작"}
            </button>
          </form>
          <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-link">Groq Console에서 Key 발급</a>
        </div>
      </section>
    </main>
  );
}
