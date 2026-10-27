import { Key, Plug, X } from "@phosphor-icons/react";

export function SettingsDialog({ onClose, onDisconnect }: { onClose: () => void; onDisconnect: () => Promise<void> }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <button className="dialog-close icon-button" onClick={onClose} aria-label="설정 닫기"><X /></button>
        <h2 id="settings-title">설정</h2>
        <div className="setting-row">
          <span><Key /></span>
          <div><strong>Groq API</strong><p>서버 임시 세션에 안전하게 연결됨</p></div>
          <span className="connected-label">연결됨</span>
        </div>
        <div className="setting-row disabled-row">
          <span><Plug /></span>
          <div><strong>Google / Microsoft Calendar</strong><p>OAuth 연동은 후속 단계에서 제공</p></div>
          <span>미연결</span>
        </div>
        <p className="settings-note">iCal은 읽기 전용, CalDAV는 쓰기 가능 공급자로 분리할 준비가 되어 있습니다.</p>
        <button className="danger-button full-button" onClick={onDisconnect}>API Key 변경 또는 연결 해제</button>
      </section>
    </div>
  );
}
