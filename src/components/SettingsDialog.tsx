import { KeyRound, Plug, X } from "lucide-react";
import { demo } from "../demo";

export function SettingsDialog({ onClose, onDisconnect }: { onClose: () => void; onDisconnect: () => Promise<void> }) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <button className="dialog-close icon-button" onClick={onClose} aria-label="설정 닫기"><X /></button>
        <h2 id="settings-title">설정</h2>
        <div className="setting-row">
          <span><KeyRound /></span>
          {demo.on
            ? <div><strong>체험용 데모</strong><p>API Key 없이 가상 데이터로 동작해요</p></div>
            : <div><strong>Groq API</strong><p>서버가 열려 있는 동안에만 Key를 기억해요</p></div>}
          <span className="connected-label">{demo.on ? "체험 중" : "연결했어요"}</span>
        </div>
        <div className="setting-row disabled-row">
          <span><Plug /></span>
          <div><strong>Google / Microsoft Calendar</strong><p>지금은 데모 캘린더만 사용할 수 있어요</p></div>
          <span>준비 중</span>
        </div>
        <p className="settings-note">iCal은 읽기 전용, CalDAV는 일정 쓰기용으로 나눠 연결할 예정이에요.</p>
        <button className="secondary-button full-button" onClick={onDisconnect}>{demo.on ? "체험 처음부터 다시 하기" : "API Key 다시 연결하기"}</button>
      </section>
    </div>
  );
}
