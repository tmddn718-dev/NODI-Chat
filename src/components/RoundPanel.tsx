import { CircleCheck, Copy, Send, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";
import { ResponseDecision } from "./ResponseDecision";
import { Toast } from "./Toast";
import type { Candidate, MeetingDraft, RoundSummary } from "../types";

const slot = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
const stamp = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const presets = [[0.5, "30분 뒤"], [1, "1시간 뒤"], [3, "3시간 뒤"], [6, "6시간 뒤"], [24, "24시간 뒤"]] as const;
const kstInput = (ms: number) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 16);

export function RoundPanel({ meeting, token, requestId, onTokenChange, onSelect }: {
  meeting: MeetingDraft;
  token: string;
  requestId: string;
  onTokenChange: (token: string) => void;
  onSelect: (candidate: Candidate) => void;
}) {
  const [round, setRound] = useState<RoundSummary | null>(null);
  const [choice, setChoice] = useState<number | "custom">(24);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!token) { setRound(null); return; }
    let active = true;
    const sync = () => api.round(token)
      .then(({ round: next }) => active && (setRound(next), setError("")))
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : "응답을 확인하지 못했어요."));
    void sync();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void sync(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token]);

  async function run(action: () => Promise<{ round: RoundSummary }>, adopt = false) {
    setBusy(true); setError("");
    try {
      const { round: next } = await action();
      setRound(next);
      if (adopt) onTokenChange(next.token);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "요청을 처리하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  const url = (urlToken: string) => `${window.location.origin}/respond/${urlToken}`;
  async function copyLink(attendee: string, urlToken: string) {
    await navigator.clipboard.writeText(url(urlToken));
    setToast(`${attendee}님의 응답 링크를 복사했어요`);
  }

  if (!round) {
    const deadlineMs = choice === "custom" ? (custom ? Date.parse(`${custom}:00+09:00`) : NaN) : Date.now() + choice * 3_600_000;
    const ready = Number.isFinite(deadlineMs) && deadlineMs > Date.now();
    return (
      <section className="rd-card" aria-labelledby="rd-start-title">
        <div className="rd-head">
          <span className="rd-icon"><Send /></span>
          <div><p className="rd-eyebrow">필수 참석자 먼저</p><h2 className="rd-title" id="rd-start-title">필수 참석자 기준으로 후보를 만들까요?</h2></div>
        </div>
        <p className="rd-body">필수 참석자의 캘린더로 후보를 먼저 고르고, 참여하면 좋은 사람에게는 그 후보만 보내 답을 받아요.</p>
        <fieldset className="rd-field">
          <legend className="rd-label">응답 마감</legend>
          <div className="rd-chips">
            {presets.map(([hours, label]) => (
              <label className="rd-chip" key={hours}><input type="radio" name="deadline" checked={choice === hours} onChange={() => setChoice(hours)} /><span>{label}</span></label>
            ))}
            <label className="rd-chip"><input type="radio" name="deadline" checked={choice === "custom"} onChange={() => { setChoice("custom"); setCustom((value) => value || kstInput(Date.now() + 24 * 3_600_000)); }} /><span>직접 입력</span></label>
          </div>
          {choice === "custom" && (
            <input className="rd-input" type="datetime-local" aria-label="응답 마감 일시" min={kstInput(Date.now())} value={custom} onChange={(event) => setCustom(event.target.value)} />
          )}
          <p className="rd-caption">{ready ? `${stamp.format(new Date(deadlineMs))}까지 응답을 받아요 (한국 표준시). 이 시간 이후에 시작하는 후보만 찾아요.` : "지금보다 뒤의 시간을 골라 주세요"}</p>
        </fieldset>
        {error && <p className="rd-error" role="alert"><TriangleAlert />{error}</p>}
        <button className="rd-btn rd-cta" disabled={busy || !ready} onClick={() => void run(() => api.createRound(meeting, requestId, new Date(deadlineMs).toISOString()), true)}>{busy ? "후보를 찾고 있어요..." : "후보 찾기"}</button>
      </section>
    );
  }

  const pending = round.participants.filter((p) => !p.responded);
  const unsent = round.participants.filter((p) => p.delivery !== "sent");
  const failed = round.participants.filter((p) => p.delivery === "failed");
  const badge = (p: RoundSummary["participants"][number]) =>
    p.responded ? ["success", "확인 완료"] : p.delivery === "sent" ? ["info", "응답 대기"] : p.delivery === "failed" ? ["error", "발송 실패"] : ["neutral", "발송 전"];
  return (
    <>
      <section className="rd-card" aria-labelledby="rd-title">
      {round.invitedAt ? (
        <div className="rd-head rd-head-live">
          <div><p className="rd-eyebrow">{round.phase === "final" ? "최종 추천" : "참석 가능 여부 확인"} · 후보 v{round.version}</p><h2 className="rd-title" id="rd-title">{pending.length ? `${pending.length}명의 응답을 기다리고 있어요` : "모든 응답을 받았어요"}</h2></div>
          <span className={`rd-badge ${pending.length ? "warning" : "success"}`}>{round.responded}/{round.total} 응답</span>
        </div>
      ) : (
        <>
      <div className="rd-head">
        <span className="rd-icon"><Send /></span>
        <div><p className="rd-eyebrow">{round.phase === "final" ? "최종 추천" : round.invitedAt ? "응답 수집 중" : "요청 발송 전"} · 후보 v{round.version}</p><h2 className="rd-title" id="rd-title">참여하면 좋은 사람 {round.responded}/{round.total}명 응답</h2></div>
      </div>
      <p className="rd-body">{stamp.format(new Date(round.deadlineAt))} 마감 · {round.phase === "final" ? "확인된 답변 기준이에요. 응답하지 않은 분은 ‘미확인’으로 남겨요." : "답변이 오면 순위가 바로 바뀌어요. 마감해도 자동으로 정해지지 않아요."}</p>
        </>
      )}
      {!round.invitedAt && (
        <div className="rd-notice">
          <span className="rd-bottom-info">일정 조율 요청 미리보기</span>
          <dl className="rd-preview">
            <div><dt>상태</dt><dd><span className="rd-badge warning">시간 미확정</span></dd></div>
            <div><dt>후보 시간</dt><dd>{round.rows.length}개</dd></div>
            <div><dt>요청 대상</dt><dd>{round.total}명</dd></div>
            <div><dt>응답 마감</dt><dd>{stamp.format(new Date(round.deadlineAt))}</dd></div>
          </dl>
          <p className="rd-body">참여하면 좋은 사람 {round.total}명에게 ‘가능한 시간을 모두 선택해 주세요’라는 요청이 나가요. 아직 회의 시간은 확정되지 않았다고 안내해요. 보내도 캘린더에 회의가 만들어지지 않아요.</p>
          <button className="rd-btn rd-cta" disabled={busy} onClick={() => void run(() => api.sendRound(token))}>{busy ? "보내고 있어요..." : "가능 시간 확인 요청 보내기"}</button>
        </div>
      )}
      {round.invitedAt && (
        <ResponseDecision
          round={round}
          busy={busy}
          onRemind={() => void run(() => api.remindRound(token))}
          onRefresh={() => void run(() => api.refreshRound(token))}
          onExtend={(deadlineAt) => void run(() => api.extendRound(token, deadlineAt))}
          onProceed={(row) => onSelect({ ...row.candidate, acceptedCount: row.accepted, unknownCount: row.tentative + row.noResponse })}
        />
      )}
      <div>
        <div className="rd-section-head"><h3>참여하면 좋은 사람</h3><span className="rd-caption">{round.responded}/{round.total}명 응답</span></div>
        {round.participants.map((p) => {
          const [tone, label] = badge(p);
          return (
            <div className="rd-person" key={p.attendee}>
              <span className="rd-avatar" aria-hidden="true">{p.attendee.slice(0, 1)}</span>
              <span className="rd-person-text"><strong>{p.attendee}</strong><span className={`rd-badge ${tone}`}>{label}</span>{p.delivery === "failed" && p.deliveryError && <span className="rd-caption">{p.deliveryError}</span>}</span>
              <button className="rd-icon-btn" aria-label={`${p.attendee} 응답 링크 복사`} onClick={() => void copyLink(p.attendee, p.urlToken)}><Copy /></button>
            </div>
          );
        })}
        <p className="rd-caption">데모에서는 실제 메일 대신 서버의 발송함(data/outbox.json)에 기록해요. 메일 주소를 알 수 없는 분은 ‘발송 실패’로 표시하고, 링크를 복사해 직접 전달할 수 있어요.</p>
      </div>
      {error && <p className="rd-error" role="alert"><TriangleAlert />{error}</p>}
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
      <div className="rd-actions">
        {round.invitedAt && failed.length > 0 && <button className="rd-btn m secondary" disabled={busy} onClick={() => void run(() => api.sendRound(token))}>발송 실패 {failed.length}명 다시 보내기</button>}
        <button className="rd-btn m ghost" disabled={busy} onClick={() => void run(() => api.refreshRound(token))}>후보 새로 찾기</button>
        <button className="rd-btn m ghost" disabled={busy || !round.invitedAt || round.reminderCount >= 1 || round.phase === "final" || !pending.length || pending.length === unsent.length} onClick={() => void run(() => api.remindRound(token))}>{round.reminderCount ? "재알림 보냄" : `미응답 ${pending.length}명 재알림`}</button>
      </div>
      </section>

      <section className="rd-card rd-card-reco" aria-labelledby="rd-reco-title">
        <div className="rd-reco-head">
          <h2 className="rd-title" id="rd-reco-title">회의 추천</h2>
          <p className="rd-body">{round.invitedAt ? "지금까지 받은 응답을 기준으로 가장 많은 사람이 가능한 시간이에요. 응답이 오면 순위가 바뀔 수 있어요." : "요청을 보내기 전 후보예요. 아직 모든 참석자의 가능 여부가 확인된 것은 아니에요."}</p>
        </div>
      <ol className="rd-list">
        {round.rows.map((row) => (
          <li className={`rd-slot ${row.rank === 1 && row.candidate.requiredAvailable ? "top" : ""}`} key={row.candidate.id}>
            <div className="rd-slot-top">
              <span className={`rd-badge ${row.candidate.requiredAvailable ? "success" : "warning"}`}>{row.candidate.requiredAvailable ? <CircleCheck /> : <TriangleAlert />}{row.candidate.requiredAvailable ? "필수 참석자 확인됨" : "잠정 · 필수 확인 필요"}</span>
              <span className={`rd-badge ${row.rank === 1 ? "recommend" : "neutral"}`}>{row.rank}순위</span>
            </div>
            <p className="rd-slot-time">{slot.format(new Date(row.candidate.start))}</p>
            {round.invitedAt && <p className="rd-reason">응답한 {round.responded}명 중 가능 {row.accepted}명 · 미응답 {row.noResponse}명{row.tentative ? ` · 확인 필요 ${row.tentative}명` : ""}</p>}
            <dl className="rd-stats">
              <div><dt>가능</dt><dd>{row.accepted}</dd></div>
              <div><dt>불가</dt><dd>{row.declined}</dd></div>
              <div><dt>미정</dt><dd>{row.tentative}</dd></div>
              <div><dt>미응답</dt><dd>{row.noResponse}</dd></div>
            </dl>
            {row.reason.includes("정렬") && <p className="rd-caption">응답이 같아 선호 시간대·빠른 시간 순으로 정렬했어요</p>}
            <p className="rd-caption">{stamp.format(new Date(row.candidate.checkedAt))} 확인 · 캘린더상 빈 시간과 참석 응답은 따로 세요</p>
            <button className={`rd-btn m ${row.rank === 1 ? "" : "secondary"}`} disabled={!row.candidate.requiredAvailable} onClick={() => onSelect({ ...row.candidate, acceptedCount: row.accepted, unknownCount: row.tentative + row.noResponse })}><span className="btn-long">이 시간으로 정하기</span><span className="btn-short">정하기</span></button>
          </li>
        ))}
      </ol>
      </section>
    </>
  );
}
