import { CalendarCheck, ChartNoAxesColumn, ShieldCheck } from "lucide-react";
import { PROTOTYPE } from "../prototype";

// 첫 진입 안내와 분석 동의. 동의하지 않아도 모든 기능을 쓸 수 있어요(분석 이벤트만 보내지 않아요).
export function ConsentNotice({ onDecide }: { onDecide: (analytics: boolean) => void }) {
  const retention = PROTOTYPE.retentionDays ? `${PROTOTYPE.retentionDays}일` : "운영자가 별도로 안내해요";
  const contact = PROTOTYPE.privacyContact || "운영자가 별도로 안내해요";
  return (
    <div className="dialog-backdrop consent-backdrop" role="presentation">
      <section className="dialog consent" role="dialog" aria-modal="true" aria-labelledby="consent-title">
        <h2 id="consent-title">NODI 테스트에 오신 걸 환영해요</h2>
        <ul className="consent-points">
          <li><CalendarCheck aria-hidden="true" /><span><strong>가상 일정이에요</strong>테스트용 가상 일정이며 실제 캘린더에는 반영되지 않아요. 메일이나 초대도 가지 않아요.</span></li>
          <li><ShieldCheck aria-hidden="true" /><span><strong>개인정보는 입력하지 마세요</strong>입력한 문장은 AI(Groq)가 이해하도록 서버로 보내져요. 이름·연락처 같은 실제 정보는 쓰지 말아 주세요.</span></li>
          <li><ChartNoAxesColumn aria-hidden="true" /><span><strong>익명 사용 데이터(선택)</strong>더 나은 화면을 만들기 위해 어디서 막히는지만 익명으로 살펴봐요. 동의하지 않아도 똑같이 쓸 수 있어요.</span></li>
        </ul>
        <details className="consent-details">
          <summary>무엇을 어떻게 수집하나요?</summary>
          <dl>
            <div><dt>수집해요</dt><dd>단계 진행과 걸린 시간, 기기 종류(모바일·태블릿·데스크톱)와 화면 크기 구간, 앱 버전, 오류 코드, 피드백 점수와 선택 태그. 임의로 만든 익명 ID로만 구분해요.</dd></div>
            <div><dt>저장해요</dt><dd>분석 도구가 만든 익명 Device ID(무작위 값)와 우리가 만든 익명 세션 ID를 이 브라우저의 저장소(localStorage)에 저장해요. 쿠키는 쓰지 않고, 철회하면 지워요.</dd></div>
            <div><dt>수집하지 않아요</dt><dd>이름, 이메일, 전화번호, 입력한 문장, 일정 내용, 자유 의견 원문, API 키. 화면을 녹화(세션 리플레이)하지도 않아요.</dd></div>
            <div><dt>사용 도구</dt><dd>Amplitude(익명 이벤트 분석). 이름·IP·위치는 보내지 않아요.</dd></div>
            <div><dt>보존 기간</dt><dd>{retention}</dd></div>
            <div><dt>철회 방법</dt><dd>설정에서 ‘익명 사용 데이터’를 끄면 바로 수집을 멈추고 익명 ID를 지워요.</dd></div>
            <div><dt>문의</dt><dd>{contact}</dd></div>
          </dl>
        </details>
        <div className="consent-actions">
          <button className="primary-button" onClick={() => onDecide(true)}>동의하고 시작</button>
          <button className="secondary-button" onClick={() => onDecide(false)}>동의하지 않고 사용</button>
        </div>
      </section>
    </div>
  );
}
