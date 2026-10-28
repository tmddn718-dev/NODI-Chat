import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
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
      setError(reason instanceof Error ? reason.message : "연결하지 못했어요.");
      setStatus("error");
    }
  }

  return (
    <main id="main-content" className="connect-shell">
      <section className="connect-intro">
        <Brand />
        <div className="intro-copy">
          <p className="overline">회의 일정 도우미</p>
          <h1>대화만 하면,<br />회의 시간이 정리돼요.</h1>
          <p>참석자 일정과 원하는 조건을 확인해 잘 맞는 시간을 찾아드려요.</p>
        </div>
        <div className="trust-note">
          <ShieldCheck size={24} />
          <span>API Key는 브라우저나 데이터베이스에 저장하지 않아요.</span>
        </div>
      </section>

      <section className="connect-panel" aria-labelledby="connect-title">
        <div className="connect-card">
          <span className="key-icon"><KeyRound size={26} /></span>
          <h2 id="connect-title">Groq를 연결해 주세요</h2>
          <p className="muted">AI로 회의 시간을 찾으려면 API Key가 필요해요.</p>
          <form onSubmit={submit}>
            <label htmlFor="api-key">Groq API Key</label>
            <div className={`input-with-action ${status === "error" ? "field-error" : ""}`}>
              <LockKeyhole size={19} aria-hidden="true" />
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
                {showKey ? <EyeOff /> : <Eye />}
              </button>
            </div>
            <p id="key-help" className={status === "error" ? "error-text" : "helper-text"} role={status === "error" ? "alert" : undefined}>
              {error || "Key는 서버가 열려 있는 동안에만 기억해요."}
            </p>
            <button className="primary-button connect-button" disabled={!apiKey.trim() || status === "loading"}>
              {status === "loading" ? "확인하고 있어요..." : "연결하고 시작하기"}
            </button>
          </form>
          <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-link">API Key가 없어요</a>
        </div>
      </section>
    </main>
  );
}
