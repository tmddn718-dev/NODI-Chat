import { Calendar, CircleCheck, Clock, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { api, ApiError } from "../api";
import type { CandidateResponseStatus, RoundInvitation } from "../types";
import { Brand } from "./Brand";

const options: Array<[CandidateResponseStatus, string]> = [["accepted", "가능"], ["declined", "불가"], ["tentative", "미정"]];
const slot = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
const time = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
const when = new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" });

export function CandidateInviteScreen({ token }: { token: string }) {
  const [invitation, setInvitation] = useState<RoundInvitation | null>(null);
  const [responses, setResponses] = useState<Record<string, CandidateResponseStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);

  function load() {
    setLoading(true);
    return api.roundInvitation(token)
      .then(({ invitation: value }) => { setInvitation(value); setResponses(value.responses); setStale(false); setError(""); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "초대를 불러오지 못했어요."))
      .finally(() => setLoading(false));
  }
  useEffect(() => { void load(); }, [token]);

  async function save() {
    if (!invitation) return;
    setSaving(true); setSaved(false); setError("");
    try {
      await api.respondToRound(token, invitation.version, responses);
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

  const answered = invitation.candidates.filter((item) => responses[item.id]).length;
  return (
    <main id="main-content" className="invite-view">
      <header className="invite-topbar"><Brand /><span>일정 응답</span></header>
      <section className="rd-page-card" aria-labelledby="round-title">
        <div className="rd-head">
          <span className="rd-icon"><Calendar /></span>
          <div><p className="rd-eyebrow">NODI 회의 후보</p><h1 className="rd-h1" id="round-title">{invitation.meeting.title}</h1></div>
        </div>
        <p className="rd-body">{invitation.meeting.purpose}</p>
        <p className="rd-meta"><span><Clock />{invitation.meeting.durationMinutes}분</span><span><Calendar />{when.format(new Date(invitation.deadlineAt))}까지 응답</span><span>한국 표준시(KST) 기준</span></p>
        <p className="rd-body"><strong>{invitation.attendee}님</strong>만 답할 수 있어요. 후보마다 가능한지 알려주세요.</p>
        {invitation.pastDeadline && <p className="rd-error" role="status"><TriangleAlert />응답 마감이 지났어요. 아직 확정 전이라면 답변이 반영될 수 있어요.</p>}
        <form className="rd-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
          {invitation.candidates.map((candidate) => (
            <fieldset className="rd-seg-group" key={candidate.id}>
              <legend>{slot.format(new Date(candidate.start))} – {time.format(new Date(candidate.end))}</legend>
              <div className="rd-seg">{options.map(([value, label]) => (
                <label key={value}><input type="radio" name={candidate.id} value={value} checked={responses[candidate.id] === value} onChange={() => { setResponses({ ...responses, [candidate.id]: value }); setSaved(false); }} /><span>{label}</span></label>
              ))}</div>
            </fieldset>
          ))}
          <p className="rd-caption">고르지 않은 후보는 ‘응답 전’으로 남아요. 불가로 처리하지 않아요. ({answered}/{invitation.candidates.length}개 응답)</p>
          {error && <p className="rd-error" role="alert"><TriangleAlert />{error}</p>}
          {stale && <button type="button" className="rd-btn m secondary" onClick={() => void load()}>최신 후보 불러오기</button>}
          {saved && <p className="rd-success" role="status"><CircleCheck />답변을 저장했어요. 이 화면에서 언제든 바꿀 수 있어요.</p>}
          <button className="rd-btn" disabled={saving || stale || !answered}>{saving ? "저장하고 있어요..." : saved ? "바꾼 답변 저장하기" : "답변 저장하기"}</button>
        </form>
      </section>
    </main>
  );
}
