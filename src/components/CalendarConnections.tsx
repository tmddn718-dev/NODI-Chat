import { Calendar, Check, X } from "lucide-react";
import { useState } from "react";
import { Brand } from "./Brand";

const providers = [
  { id: "google", name: "Google Calendar", mark: "G" },
  { id: "microsoft", name: "Microsoft 365", mark: "M" },
  { id: "apple", name: "Apple 캘린더", mark: "A" },
];
const reads = [
  { title: "바쁨 · 한가함 시간", desc: "일정이 있는지 없는지만 읽어서 후보 시간을 찾아요.", read: true },
  { title: "일정 제목 · 내용 · 참석자", desc: "읽거나 저장하지 않아요.", read: false },
  { title: "일정 만들기 · 수정 · 삭제", desc: "하지 않아요. 회의를 정해도 데모에서는 캘린더에 쓰지 않아요.", read: false },
];

export function CalendarConnections({ onBack }: { onBack: () => void }) {
  const [target, setTarget] = useState<(typeof providers)[number] | null>(null);
  return (
    <main id="main-content" className="meetings-view">
      <header className="meetings-topbar">
        <Brand />
        <button className="ghost-button" onClick={onBack}>회의 잡기로 돌아가기</button>
      </header>
      <section className="meetings-content" aria-labelledby="cal-title">
        <div className="meetings-heading">
          <div><p className="overline">캘린더 연결</p><h1 id="cal-title">연결한 캘린더</h1><p>연결한 캘린더의 바쁜 시간만 읽어서 모두에게 잘 맞는 시간을 찾아요.</p></div>
        </div>

        <div className="meetings-group">
          <h2 className="meetings-group-title">연결됨 <span>1</span></h2>
          <div className="cal-list">
            <div className="cal-row">
              <span className="sub-avatar" aria-hidden="true"><Calendar /></span>
              <span className="meeting-list-copy"><strong>Demo Workspace</strong><small>가상 Free/Busy 데이터 · 구성원 5명</small></span>
              <span className="status-badge status-success"><Check /> 연결됨</span>
            </div>
          </div>
          <p className="cal-help">지금은 이 가상 캘린더만 써요. 실제 일정은 읽지 않고, 회의를 정해도 어디에도 쓰지 않아요.</p>
        </div>

        <div className="meetings-group">
          <h2 className="meetings-group-title">연결할 수 있는 캘린더 <span>{providers.length}</span></h2>
          <div className="cal-list">
            {providers.map((provider) => (
              <div className="cal-row" key={provider.id}>
                <span className="sub-avatar" aria-hidden="true">{provider.mark}</span>
                <span className="meeting-list-copy"><strong>{provider.name}</strong><small>아직 연결하지 않았어요</small></span>
                <button className="rd-btn m secondary" onClick={() => setTarget(provider)}>연결하기</button>
              </div>
            ))}
          </div>
        </div>

        <div className="meetings-group">
          <h2 className="meetings-group-title">NODI가 가져오는 정보</h2>
          <div className="cal-list">
            {reads.map((item) => (
              <div className="cal-row" key={item.title}>
                <span className="meeting-list-copy"><strong>{item.title}</strong><small>{item.desc}</small></span>
                <span className={`status-badge ${item.read ? "status-info" : "status-neutral"}`}>{item.read ? "읽어요" : "읽지 않아요"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {target && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setTarget(null)}>
          <section className="dialog cd" role="dialog" aria-modal="true" aria-labelledby="cal-dialog-title">
            <header className="cd-head">
              <span className="cd-badge">캘린더 연결</span>
              <button className="dialog-close icon-button" onClick={() => setTarget(null)} aria-label="닫기"><X /></button>
            </header>
            <h2 id="cal-dialog-title">{target.name}은 아직 연결할 수 없어요</h2>
            <p className="cd-sub">데모에서는 실제 계정을 연결하지 않아요. 연결하려면 서버에 로그인 연동 설정(OAuth)과 개인정보 동의 절차가 먼저 필요해요.</p>
            <div className="cd-section">
              <div className="cd-people"><div><strong>지금 쓰는 캘린더</strong><span>Demo Workspace (가상 Free/Busy 데이터)</span></div><em>연결됨</em></div>
            </div>
            <div className="dialog-actions"><button className="primary-button" onClick={() => setTarget(null)}>확인</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
