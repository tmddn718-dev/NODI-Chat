import { ChartNoAxesColumn, KeyRound, MessageSquareText, Plug, X } from "lucide-react";
import { demo } from "../demo";

export function SettingsDialog({ onClose, onDisconnect, analyticsOn, onToggleAnalytics, onFeedback }: {
  onClose: () => void;
  onDisconnect: () => Promise<void>;
  // 공개 테스트에서만 넘겨져요: 익명 사용 데이터 동의 상태와 철회, 의견 보내기
  analyticsOn?: boolean;
  onToggleAnalytics?: (analytics: boolean) => void;
  onFeedback?: () => void;
}) {
  const isPublic = demo.mode === "public";
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <button className="dialog-close icon-button" onClick={onClose} aria-label="설정 닫기"><X /></button>
        <h2 id="settings-title">설정</h2>
        <div className="setting-row">
          <span><KeyRound /></span>
          {isPublic
            ? <div><strong>공개 테스트</strong><p>가상 일정으로 동작하고, 실제 캘린더에는 반영되지 않아요</p></div>
            : demo.on
              ? <div><strong>체험용 데모</strong><p>API Key 없이 가상 데이터로 동작해요</p></div>
              : <div><strong>Groq API</strong><p>서버가 열려 있는 동안에만 Key를 기억해요</p></div>}
          <span className="connected-label">{demo.on ? (isPublic ? "테스트 중" : "체험 중") : "연결했어요"}</span>
        </div>
        {isPublic && onToggleAnalytics && (
          <div className="setting-row">
            <span><ChartNoAxesColumn /></span>
            <div><strong>익명 사용 데이터</strong><p>{analyticsOn ? "단계·기기·오류 코드를 익명으로 수집하고 있어요. 입력한 문장과 일정 내용은 수집하지 않아요." : "수집하지 않고 있어요."}</p></div>
            <button className="soft-pill" onClick={() => onToggleAnalytics(!analyticsOn)}>{analyticsOn ? "철회하기" : "동의하기"}</button>
          </div>
        )}
        {isPublic && onFeedback && (
          <div className="setting-row">
            <span><MessageSquareText /></span>
            <div><strong>의견 보내기</strong><p>점수와 불편했던 점을 알려 주세요</p></div>
            <button className="soft-pill" onClick={onFeedback}>열기</button>
          </div>
        )}
        <div className="setting-row disabled-row">
          <span><Plug /></span>
          <div><strong>Google / Microsoft Calendar</strong><p>지금은 데모 캘린더만 사용할 수 있어요</p></div>
          <span>준비 중</span>
        </div>
        <p className="settings-note">iCal은 읽기 전용, CalDAV는 일정 쓰기용으로 나눠 연결할 예정이에요.</p>
        <button className="secondary-button full-button" onClick={onDisconnect}>{isPublic ? "테스트 데이터 초기화" : demo.on ? "체험 처음부터 다시 하기" : "API Key 다시 연결하기"}</button>
        {isPublic && <p className="settings-note">내 가상 회의와 입력을 지우고 처음부터 다시 해요. 다른 사람의 데이터나 분석 기록에는 영향이 없어요.</p>}
      </section>
    </div>
  );
}
