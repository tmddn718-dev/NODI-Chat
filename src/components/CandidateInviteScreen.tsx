import { Check, CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { CandidateResponseStatus, RoundInvitation } from "../types";
import { Brand } from "./Brand";

const slot = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
const time = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
const when = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" });

export function CandidateInviteScreen({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<RoundInvitation | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState<"pick" | "none" | "unsure">("pick");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);

  function restore(saved: Record<string, CandidateResponseStatus>, ids: string[]) {
    const values = ids.map((id) => saved[id]);
    setPicked(ids.filter((id) => saved[id] === "accepted"));
    setMode(values.length && values.every((v) => v === "declined") ? "none" : values.length && values.every((v) => v === "tentative") ? "unsure" : "pick");
  }

  function load() {
    setLoading(true);
    return api.roundInvitation(token)
      .then(({ invitation: value }) => { setInvitation(value); restore(value.responses, value.candidates.map((c) => c.id)); setStale(false); setError(""); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "초대를 불러오지 못했어요."))
      .finally(() => setLoading(false));
  }
  useEffect(() => { void load(); }, [token]);

  // 고른 시간은 가능, 고르지 않은 시간은 불가로 전달해요. "모두 불가"·"아직 어려움"은 전체에 같은 답을 줘요.
  function buildResponses(): Record<string, CandidateResponseStatus> {
    const all = invitation?.candidates ?? [];
    return Object.fromEntries(all.map((c) => [c.id, mode === "none" ? "declined" : mode === "unsure" ? "tentative" : picked.includes(c.id) ? "accepted" : "declined"]));
  }

  async function save() {
    if (!invitation) return;
    setSaving(true); setSaved(false); setError("");
    try {
      await api.respondToRound(token, invitation.version, buildResponses());
      setSaved(true);
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "stale_invitation") setStale(true);
      setError(reason instanceof Error ? reason.message : "답변을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !invitation) return <main id="main-content" className="boot-screen" aria-label="초대를 불러오는 중"><span className="boot-logo">N</span><div className="boot-line" /></main>;
  if (!invitation) return <main id="main-content" className="invite-view"><section className="invite-card error-state"><TriangleAlert /><h1>초대장을 열 수 없어요</h1><p>{error}</p></section></main>;

  const ready = mode !== "pick" || picked.length > 0;
  return (
    <main id="main-content" className="invite-view">
      <header className="invite-topbar"><Brand /><span className="rd-badge warning">시간 미확정</span></header>
      <section className="rd-page-card" aria-labelledby="round-title">
        <div>
          <h1 className="rd-h1" id="round-title">언제 참여할 수 있나요?</h1>
          <p className="rd-body">{invitation.meeting.title} · {invitation.meeting.durationMinutes}분</p>
        </div>
        <p className="rd-body">{invitation.attendee}님, 가능한 시간을 모두 선택해 주세요. 아직 회의 시간은 확정되지 않았어요.</p>
        <p className="rd-meta"><span><Clock />{when.format(new Date(invitation.deadlineAt))}까지 응답</span><span>한국 표준시(KST) 기준</span></p>
        {invitation.pastDeadline && <p className="rd-error" role="status"><TriangleAlert />응답 마감이 지났어요. 아직 확정 전이라면 답변이 반영될 수 있어요.</p>}
        <form className="rd-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          <div className="rd-picks" role="group" aria-label="가능한 시간">
            {invitation.candidates.map((candidate) => {
              const on = mode === "pick" && picked.includes(candidate.id);
              return (
                <label className={`rd-pick ${on ? "on" : ""} ${mode !== "pick" ? "dim" : ""}`} key={candidate.id}>
                  <input type="checkbox" checked={on} disabled={mode !== "pick"} onChange={() => { setPicked(on ? picked.filter((id) => id !== candidate.id) : [...picked, candidate.id]); setSaved(false); }} />
                  <span className="rd-pick-mark" aria-hidden="true">{on && <Check />}</span>
                  <span className="rd-pick-text"><strong>{slot.format(new Date(candidate.start))}</strong><span>{time.format(new Date(candidate.start))} - {time.format(new Date(candidate.end))}</span></span>
                  <span className="rd-pick-state">{on ? "가능" : mode === "pick" ? "선택 안 함" : ""}</span>
                </label>
              );
            })}
          </div>
          <label className="rd-check"><input type="checkbox" checked={mode === "none"} onChange={(event) => { setMode(event.target.checked ? "none" : "pick"); setSaved(false); }} /><span>모든 후보 시간이 어려워요</span></label>
          <label className="rd-check"><input type="checkbox" checked={mode === "unsure"} onChange={(event) => { setMode(event.target.checked ? "unsure" : "pick"); setSaved(false); }} /><span>아직 결정하기 어려워요</span></label>
          <p className="rd-caption">고르지 않은 시간은 ‘불가’로 전달돼요. 아무것도 고르지 않고 제출할 수는 없어요.</p>
          {error && <p className="rd-error" role="alert"><TriangleAlert />{error}</p>}
          {stale && <button type="button" className="rd-btn m secondary" onClick={() => void load()}>최신 후보 불러오기</button>}
          {saved && <p className="rd-success" role="status"><CircleCheck />가능한 시간을 전달했어요. 회의 시간이 확정되면 다시 안내해 드릴게요. 이 화면에서 언제든 바꿀 수 있어요.</p>}
          <button className="rd-btn rd-cta" disabled={saving || stale || !ready}>{saving ? "제출하고 있어요..." : saved ? "바꾼 답변 제출하기" : "응답 제출"}</button>
        </form>
      </section>
    </main>
  );
}
