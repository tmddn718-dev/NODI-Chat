import { demo } from "../demo";
import { CircleCheck, Copy, Send, TriangleAlert } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { CompareBar, CompareTable } from "./CompareTable";
import { RecommendationCard, type ReasonLine } from "./RecommendationCard";
import { MOBILE_QUERY, useMedia } from "../useMedia";
import { ResponseDecision } from "./ResponseDecision";
import { Toast } from "./Toast";
import type { Candidate, MeetingDraft, RoundSummary } from "../types";
import { namesLabel } from "../format";
import { recommendationState } from "../recommendationState";

const slot = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
const stamp = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const presets = [[0.5, "30분 뒤"], [1, "1시간 뒤"], [3, "3시간 뒤"], [6, "6시간 뒤"], [24, "24시간 뒤"]] as const;
const kstInput = (ms: number) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 16);

export function RoundPanel({ meeting, token, requestId, onTokenChange, onSelect, onEditRequired, onPhase }: {
  meeting: MeetingDraft;
  token: string;
  requestId: string;
  onTokenChange: (token: string) => void;
  onSelect: (candidate: Candidate) => void;
  onEditRequired?: () => void;
  onPhase?: (info: { loaded: boolean; invited: boolean; pending: number; total: number }) => void;
}) {
  const [round, setRound] = useState<RoundSummary | null>(null);
  const [onlyPending, setOnlyPending] = useState(false);
  const [comparing, setComparing] = useState(false);
  const isMobile = useMedia(MOBILE_QUERY);
  const [picked, setPicked] = useState<string[]>([]);
  const topRef = useRef<string | undefined>(undefined);
  const [rankNotice, setRankNotice] = useState("");
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

  // 응답이 도착해 1순위가 바뀌면, 화면을 조용히 갱신하는 대신 이유를 한 줄로 알려줘요.
  useEffect(() => {
    const top = round?.rows[0];
    if (!round?.invitedAt || !top) { topRef.current = top?.candidate.id; return; }
    if (topRef.current && topRef.current !== top.candidate.id) setRankNotice(`응답이 도착해서 추천 순서가 바뀌었어요. 새 1순위는 ${slot.format(new Date(top.candidate.start))}예요.`);
    topRef.current = top.candidate.id;
  }, [round]);

  // 요청을 보내기 전(2단계)과 후(3단계)를 화면 상단 단계 표시에 알려줘요.
  useEffect(() => { onPhase?.({ loaded: Boolean(round), invited: Boolean(round?.invitedAt), pending: round ? round.participants.filter((p) => !p.responded).length : 0, total: round?.total ?? 0 }); }, [round?.invitedAt, round?.responded, round?.total]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // 참석자가 많으면(9명 이상) 팀별로 묶고, 미응답만 골라 볼 수 있어요.
  const manyPeople = round.participants.length > 8;
  const peopleGroups = (() => {
    const map = new Map<string, RoundSummary["participants"]>();
    for (const p of round.participants) {
      if (manyPeople && onlyPending && p.responded) continue;
      const team = manyPeople ? (p.team ?? "기타") : "";
      map.set(team, [...(map.get(team) ?? []), p]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "ko"));
  })();
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
        <>
          <section className="rd-notice first-pass" aria-label="1차 일정 탐색 결과">
            <span className="rd-bottom-info">1차 일정 탐색 결과</span>
            <p className="first-pass-count">찾은 후보 {round.rows.length}개</p>
            <ul className="rd-evidence">
              <li className="ok"><CircleCheck aria-hidden="true" /><span>확인 가능한 캘린더 검토</span></li>
              <li className="ok"><CircleCheck aria-hidden="true" /><span>회의 시간 및 날짜 조건 반영</span></li>
              <li className="warn"><TriangleAlert aria-hidden="true" /><span>참석 가능 여부 추가 확인 필요</span></li>
            </ul>
            <p className="rd-caption">필수 참석자는 캘린더로 먼저 확인했어요. 캘린더상 빈 시간은 참석 수락이 아니라서, 나머지 참석자에게는 후보별로 가능 여부를 물어봐요.</p>
          </section>
          {round.total === 0 ? <p className="rd-caption">추가로 확인할 사람이 없어요. 아래 후보를 바로 확인할 수 있어요.</p> : <div className="rd-notice">
            <span className="rd-bottom-info">추가 확인이 필요한 사람이 있어요</span>
            <p className="rd-body">캘린더로 확인할 수 없는 선택 참석자 {round.total}명에게 후보 시간별로 참석 가능 여부를 물어볼 수 있어요. 요청을 보내지 않아도 아래 후보를 먼저 볼 수 있어요.</p>
            <dl className="rd-preview">
              <div><dt>상태</dt><dd><span className="rd-badge warning">시간 미확정</span></dd></div>
              <div><dt>후보 시간</dt><dd>{round.rows.length}개</dd></div>
              <div><dt>확인이 필요한 참석자</dt><dd>{round.total}명</dd></div>
              <div><dt>응답 마감</dt><dd>{stamp.format(new Date(round.deadlineAt))}</dd></div>
            </dl>
            <details className="rd-request-preview">
              <summary>요청 내용 미리보기</summary>
              <p>“다음 시간 중 참석 가능한 시간을 모두 알려주세요.”</p>
              <ul>{round.rows.map((row) => <li key={row.candidate.id}>{slot.format(new Date(row.candidate.start))}</li>)}</ul>
            </details>
            <p className="rd-body">정식 회의 초대가 아니에요. 아직 회의 시간은 확정되지 않았다고 안내하고, 보내도 캘린더에 회의가 만들어지지 않아요. 확정하면 그때 회의 초대를 따로 안내해요.</p>
            <button className="rd-btn rd-cta" disabled={busy} onClick={() => void run(() => api.sendRound(token))}>{busy ? "요청하고 있어요..." : "참석 가능 여부 확인하기"}</button>
            <button type="button" className="rd-btn secondary" onClick={() => document.getElementById("rd-reco-title")?.scrollIntoView({ behavior: "smooth", block: "start" })}>현재 후보 먼저 보기</button>
          </div>}
        </>
      )}
      {round.invitedAt && (
        <ResponseDecision
          round={round}
          busy={busy}
          onRemind={() => void run(() => api.remindRound(token))}
          onRefresh={() => void run(() => api.refreshRound(token))}
          onExtend={(deadlineAt) => void run(() => api.extendRound(token, deadlineAt))}
          onCompare={() => setComparing(true)}
          onEditRequired={onEditRequired}
          onProceed={(row) => onSelect({ ...row.candidate, acceptedCount: row.accepted, unknownCount: row.tentative + row.noResponse })}
        />
      )}
      <details className="rsc-people" open={!round.invitedAt}>
        <summary>참석자별 상태 보기 <span className="rd-caption">{round.responded}/{round.total}명 응답</span><ChevronDown aria-hidden="true" /></summary>
        {manyPeople && (
          <div className="rsc-people-tools">
            <label><input type="checkbox" checked={onlyPending} onChange={(event) => setOnlyPending(event.target.checked)} /> 미응답만 보기 ({pending.length}명)</label>
          </div>
        )}
        {peopleGroups.map(([team, members]) => (
          <div className="rsc-team" key={team || "all"}>
            {manyPeople && <p className="rsc-team-head">{team} <span>{members.filter((p) => p.responded).length}/{members.length}명 응답</span></p>}
            {members.map((p) => {
              const [tone, label] = badge(p);
              return (
                <div className="rd-person" key={p.attendee}>
                  <span className="rd-avatar" aria-hidden="true">{p.attendee.slice(0, 1)}</span>
                  <span className="rd-person-text"><strong>{p.attendee}</strong><span className={`rd-badge ${tone}`}>{label}</span>{p.delivery === "failed" && p.deliveryError && <span className="rd-caption">{p.deliveryError}</span>}</span>
                  <button className="rd-icon-btn" aria-label={`${p.attendee} 응답 링크 복사`} onClick={() => void copyLink(p.attendee, p.urlToken)}><Copy /></button>
                </div>
              );
            })}
          </div>
        ))}
        {manyPeople && onlyPending && !pending.length && <p className="rd-caption">미응답인 사람이 없어요.</p>}
        <p className="rd-caption">{demo.on ? "데모에서는 실제 메일을 보내지 않아요. 발송 기록만 남겨요." : "데모에서는 실제 메일 대신 서버의 발송함(data/outbox.json)에 기록해요."} 메일 주소를 알 수 없는 분은 ‘발송 실패’로 표시하고, 링크를 복사해 직접 전달할 수 있어요.</p>
      </details>
      {error && <p className="rd-error" role="alert"><TriangleAlert />{error}</p>}
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
      <div className="rd-actions">
        {round.invitedAt && failed.length > 0 && <button className="rd-btn m secondary" disabled={busy} onClick={() => void run(() => api.sendRound(token))}>발송 실패 {failed.length}명 다시 보내기</button>}
        <button className="rd-btn m ghost" disabled={busy} onClick={() => void run(() => api.refreshRound(token))}>후보 새로 찾기</button>
        {demo.on && round.invitedAt && pending.length > 0 && !unsent.length && <button className="rd-btn m secondary" disabled={busy} onClick={() => void run(() => api.demoResponses(token))}>가상 참석자 응답 받기 (데모)</button>}
        <button className="rd-btn m ghost" disabled={busy || !round.invitedAt || round.reminderCount >= 1 || round.phase === "final" || !pending.length || pending.length === unsent.length} onClick={() => void run(() => api.remindRound(token))}>{round.reminderCount ? "재알림 보냄" : `미응답 ${pending.length}명 재알림`}</button>
      </div>
      </section>

      <section className="rd-card rd-card-reco" aria-labelledby="rd-reco-title">
        <div className="rd-reco-head">
          <h2 className="rd-title" id="rd-reco-title">회의 추천</h2>
          {rankNotice && <p className="rd-rank-notice" role="status">{rankNotice} <button type="button" className="text-link" onClick={() => setRankNotice("")}>확인</button></p>}
          <p className="rd-body">{round.invitedAt ? "지금까지 받은 응답을 기준으로 가장 많은 사람이 가능한 시간이에요. 응답이 오면 순위가 바뀔 수 있어요." : "요청을 보내기 전 후보예요. 아직 모든 참석자의 가능 여부가 확인된 것은 아니에요."}</p>
        </div>
      {round.rows.length > 1 && <button type="button" className="rd-more compare-toggle" aria-expanded={comparing} onClick={() => setComparing((value) => !value)}>{comparing ? "비교 닫기" : "다른 후보 비교하기"}</button>}
      {comparing && (
        <CompareTable
          onClose={() => setComparing(false)}
          columns={round.rows.filter((row) => !isMobile || picked.length < 2 || picked.includes(row.candidate.id)).map((row) => ({ id: row.candidate.id, label: slot.format(new Date(row.candidate.start)), required: row.candidate.requiredAvailable ? "충돌 없음" : "확인 필요", possible: row.accepted, impossible: row.declined, waiting: row.noResponse + row.tentative, unknown: 0, onSelect: row.candidate.requiredAvailable ? () => onSelect({ ...row.candidate, acceptedCount: row.accepted, unknownCount: row.tentative + row.noResponse }) : undefined }))}
        />
      )}
      <ol className="rd-list rcard-list">
        {round.rows.map((row) => {
          const people = row.people;
          const waiting = [...(people?.tentative ?? []), ...(people?.noResponse ?? [])];
          const ok = row.candidate.requiredAvailable;
          const state = recommendationState({ requiredOk: ok, requiredConflict: row.candidate.unavailable.length > 0, optionalConflict: row.declined, index: row.rank - 1 });
          const reasons: ReasonLine[] = [
            { kind: ok ? "ok" : "warn", text: ok ? "필수 참석자 조건 충족" : row.candidate.unavailable.length ? `필수 참석자 ${namesLabel(row.candidate.unavailable)}님 일정이 맞지 않아요` : "필수 참석자 확인이 필요해요" },
            ...(ok ? [{ kind: "ok" as const, text: "현재 확인된 일정 충돌 없음" }] : []),
            ...((people?.accepted.length ?? 0) > 0 ? [{ kind: "ok" as const, text: `${namesLabel(people!.accepted)} 참석 가능 응답` }] : []),
            ...((people?.declined.length ?? 0) > 0 ? [{ kind: "warn" as const, text: `${namesLabel(people!.declined)} 참석 불가 응답` }] : []),
            ...(waiting.length > 0 ? [{ kind: "wait" as const, text: `선택 참석자 ${waiting.length}명 응답 대기` }] : []),
          ];
          return (
            <RecommendationCard
              key={row.candidate.id}
              top={row.rank === 1 && ok}
              label={row.rank === 1 ? "가장 추천" : `대안 ${row.rank - 1}`}
              start={row.candidate.start}
              end={row.candidate.end}
              badge={state.badge}
              reasons={reasons}
              canSelect={state.canSelect}
              onSelect={() => onSelect({ ...row.candidate, acceptedCount: row.accepted, unknownCount: row.tentative + row.noResponse })}
              compare={isMobile && round.rows.length > 1 ? { checked: picked.includes(row.candidate.id), disabled: picked.length >= 3, onToggle: () => setPicked((current) => current.includes(row.candidate.id) ? current.filter((id) => id !== row.candidate.id) : [...current, row.candidate.id]) } : undefined}
              details={(
                <>
                  <dl className="rcard-facts">
                    <div><dt>참석 가능 응답</dt><dd>{row.accepted}명</dd></div>
                    <div><dt>참석 불가 응답</dt><dd>{row.declined}명</dd></div>
                    <div><dt>아직 몰라요</dt><dd>{row.tentative}명</dd></div>
                    <div><dt>응답 대기</dt><dd>{row.noResponse}명</dd></div>
                  </dl>
                  {row.reason.includes("정렬") && <p className="rd-caption">응답이 같아 선호 시간대·빠른 시간 순으로 정렬했어요.</p>}
                  <p className="rd-caption">{stamp.format(new Date(row.candidate.checkedAt))} 확인 · 캘린더상 빈 시간과 참석 응답은 따로 세요.</p>
                </>
              )}
            />
          );
        })}
      </ol>
      {isMobile && round.rows.length > 1 && <CompareBar count={picked.length} onOpen={() => setComparing(true)} onClear={() => setPicked([])} />}
      </section>
    </>
  );
}
