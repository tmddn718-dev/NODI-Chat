import {
  ArrowUp,
  Bell,
  CalendarBlank,
  CheckCircle,
  GearSix,
  Globe,
  PlugsConnected,
  Robot,
  Sparkle,
  UserCircle,
  UsersThree,
  WifiSlash,
} from "@phosphor-icons/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import { getGuidedStep, type GuidedChoice } from "../guided";
import type { AvailabilityResponse, Candidate, DraftPayload, InvitationLink, MeetingDraft, MeetingEvent, Message } from "../types";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { AttendeePicker } from "./AttendeePicker";
import { Brand } from "./Brand";
import { CandidateList } from "./CandidateList";
import { ConfirmDialog } from "./ConfirmDialog";
import { DateRangePicker } from "./DateRangePicker";
import { GuidedChoices } from "./GuidedChoices";
import { MeetingSummary } from "./MeetingSummary";
import { RequiredAttendeePicker } from "./RequiredAttendeePicker";

const intro: Message = {
  id: "intro",
  role: "assistant",
  content: "어떤 회의를 잡을까요? 아래에서 골라도 되고, 편하게 입력해도 돼요.",
};

const emptyMeeting = (): MeetingDraft => ({ timezone: "Asia/Seoul", version: 1 });
const draftStorageKey = "nodi_meeting_draft_v2";

function restoreDraft() {
  try {
    return JSON.parse(localStorage.getItem(draftStorageKey) ?? "null") as {
      meeting: MeetingDraft;
      availability: AvailabilityResponse[];
      messages: Message[];
      invitationToken?: string;
      invitationLinks?: InvitationLink[];
      invitationRequestId?: string;
      input?: string;
      language?: "ko" | "en";
      model?: string;
      savedAt?: string;
    } | null;
  } catch {
    return null;
  }
}

export function ChatScreen({
  models,
  onSettings,
  onShowMeetings,
  onConfirmed,
}: {
  models: string[];
  onSettings: () => void;
  onShowMeetings: () => void;
  onConfirmed: (event: MeetingEvent) => void;
}) {
  const [restored] = useState(restoreDraft);
  const [messages, setMessages] = useState<Message[]>(restored?.messages?.length ? restored.messages : [intro]);
  const [meeting, setMeeting] = useState<MeetingDraft>(restored?.meeting ?? emptyMeeting);
  const [input, setInput] = useState(restored?.input ?? "");
  const [model, setModel] = useState(restored?.model && models.includes(restored.model) ? restored.model : models.includes("llama-3.3-70b-versatile") ? "llama-3.3-70b-versatile" : models[0] ?? "");
  const [language, setLanguage] = useState<"ko" | "en">(restored?.language ?? "ko");
  const [loading, setLoading] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendationComplete, setRecommendationComplete] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [availability, setAvailability] = useState<AvailabilityResponse[]>(restored?.availability ?? []);
  const [confirmRequestId, setConfirmRequestId] = useState("");
  const [invitationToken, setInvitationToken] = useState(restored?.invitationToken ?? "");
  const [invitationLinks, setInvitationLinks] = useState<InvitationLink[]>(restored?.invitationLinks ?? []);
  const [invitationRequestId, setInvitationRequestId] = useState(restored?.invitationRequestId ?? crypto.randomUUID());
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [lastInviteSyncAt, setLastInviteSyncAt] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [lastAction, setLastAction] = useState<"chat" | "recommendations" | null>(null);
  const [customPlaceholder, setCustomPlaceholder] = useState("");
  const [serverReady, setServerReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"loading" | "saving" | "saved" | "conflict" | "error">("loading");
  const draftVersionRef = useRef(0);
  const availabilityRef = useRef(availability);
  const endRef = useRef<HTMLDivElement>(null);
  const guidedStep = getGuidedStep(meeting, language);

  useEffect(() => {
    const attendees = meeting.attendees ?? [];
    setAvailability((current) => attendees.map((attendee) =>
      current.find((response) => response.attendee === attendee) ?? { attendee, status: "no_response" },
    ));
  }, [meeting.attendees?.join("|")]);

  useEffect(() => {
    let active = true;
    api.draft()
      .then(({ draft }) => {
        if (!active) return;
        draftVersionRef.current = draft?.version ?? 0;
        if (draft && (!restored?.savedAt || Date.parse(draft.updatedAt) >= Date.parse(restored.savedAt))) applyDraft(draft.payload);
        setSyncStatus(draft ? "saved" : "saving");
      })
      .catch(() => active && setSyncStatus("error"))
      .finally(() => active && setServerReady(true));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const payload: DraftPayload = { meeting, availability, messages, invitationToken: invitationToken || undefined, invitationLinks, invitationRequestId, input, language, model };
    localStorage.setItem(draftStorageKey, JSON.stringify({ ...payload, savedAt: new Date().toISOString() }));
    if (!serverReady || syncStatus === "conflict" || !online) return;
    setSyncStatus("saving");
    const timeout = window.setTimeout(() => {
      api.saveDraft(draftVersionRef.current, payload)
        .then(({ draft }) => {
          draftVersionRef.current = draft.version;
          setSyncStatus("saved");
        })
        .catch((reason) => setSyncStatus(reason instanceof ApiError && reason.status === 409 ? "conflict" : "error"));
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [meeting, availability, messages, invitationToken, invitationLinks, invitationRequestId, input, language, model, serverReady, online]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    availabilityRef.current = availability;
  }, [availability]);

  useEffect(() => {
    if (!invitationToken || !online) return;
    let active = true;

    async function syncResponses() {
      try {
        const result = await api.invitationAvailability(invitationToken);
        if (!active) return;
        const changed = JSON.stringify(result.availability) !== JSON.stringify(availabilityRef.current);
        if (changed) {
          availabilityRef.current = result.availability;
          setAvailability(result.availability);
          setCandidates([]);
          setRecommendationComplete(false);
          setSelected(null);
        }
        setLastInviteSyncAt(result.updatedAt);
        setInviteError("");
      } catch (reason) {
        if (active) setInviteError(reason instanceof Error ? reason.message : "초대 응답을 확인하지 못했어요.");
      }
    }

    void syncResponses();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncResponses();
    }, 5000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void syncResponses();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [invitationToken, online]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, candidates, loading]);

  function applyDraft(payload: DraftPayload) {
    setMeeting(payload.meeting ?? emptyMeeting());
    setAvailability(payload.availability ?? []);
    setMessages(payload.messages?.length ? payload.messages : [intro]);
    setInvitationToken(payload.invitationToken ?? "");
    setInvitationLinks(payload.invitationLinks ?? []);
    setInvitationRequestId(payload.invitationRequestId ?? crypto.randomUUID());
    setInput(payload.input ?? "");
    setLanguage(payload.language ?? "ko");
    if (payload.model && models.includes(payload.model)) setModel(payload.model);
    setCandidates([]);
    setRecommendationComplete(false);
    setSelected(null);
  }

  async function loadServerDraft() {
    setSyncStatus("loading");
    try {
      const { draft } = await api.draft();
      draftVersionRef.current = draft?.version ?? 0;
      if (draft) applyDraft(draft.payload);
      setSyncStatus("saved");
    } catch {
      setSyncStatus("error");
    }
  }

  function restart() {
    setMessages([intro]);
    setMeeting(emptyMeeting());
    setCandidates([]);
    setRecommendationComplete(false);
    setSelected(null);
    setError("");
    setInput("");
    setCustomPlaceholder("");
    setAvailability([]);
    setConfirmRequestId("");
    setInvitationToken("");
    setInvitationLinks([]);
    setInvitationRequestId(crypto.randomUUID());
    setInviteError("");
    setLastInviteSyncAt("");
    setLastAction(null);
    localStorage.removeItem(draftStorageKey);
    setServerReady(false);
    setSyncStatus("saving");
    void api.deleteDraft()
      .then(() => {
        draftVersionRef.current = 0;
        setServerReady(true);
      })
      .catch(() => {
        setSyncStatus("error");
        setServerReady(true);
      });
  }

  async function findRecommendations(nextMeeting: MeetingDraft, responses: AvailabilityResponse[]) {
    if (!navigator.onLine) {
      setError("인터넷에 연결되지 않았어요. 입력한 내용은 이 기기에 보관하고 있어요.");
      setLastAction("recommendations");
      return;
    }
    setRecommendLoading(true);
    setError("");
    try {
      const recommendation = await api.recommendations(nextMeeting, responses, invitationToken || undefined);
      setAvailability(recommendation.availability);
      setCandidates(recommendation.candidates);
      setRecommendationComplete(true);
      setLastAction(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "맞는 시간을 찾지 못했어요.");
      setLastAction("recommendations");
    } finally {
      setRecommendLoading(false);
    }
  }

  async function send(text: string, retry = false) {
    const content = text.trim();
    if ((!content && !retry) || loading) return;
    if (!navigator.onLine) {
      setError("인터넷에 연결되지 않았어요. 작성 중인 내용은 이 기기에 보관하고 있어요.");
      setLastAction(null);
      return;
    }
    const nextMessages = retry ? messages : [...messages, { id: crypto.randomUUID(), role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    setCustomPlaceholder("");
    setLoading(true);
    setError("");
    setCandidates([]);
    setRecommendationComplete(false);
    try {
      const result = await api.chat({
        messages: nextMessages.map(({ role, content: value }) => ({ role, content: value })),
        meeting,
        model,
        language,
      });
      const nextMeeting = { ...(result.meeting ?? meeting), version: (meeting.version ?? 1) + 1 };
      setMeeting(nextMeeting);
      setInvitationToken("");
      setInvitationLinks([]);
      setInvitationRequestId(crypto.randomUUID());
      setModel(result.model);
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: result.assistantMessage },
      ]);
      if (result.complete) setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: "필요한 정보가 다 모였어요. 이제 참석 가능한 시간을 확인할게요." },
      ]);
      setLastAction(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "메시지를 보내지 못했어요.");
      setLastAction("chat");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  function startDirectInput(placeholder: string) {
    setCustomPlaceholder(placeholder);
    requestAnimationFrame(() => document.getElementById("chat-input")?.focus());
  }

  function selectGuidedChoice(choice: GuidedChoice) {
    const nextMeeting = { ...meeting, ...choice.patch, version: (meeting.version ?? 1) + 1 };
    const nextStep = getGuidedStep(nextMeeting, language);
    const assistantMessage = nextStep
      ? language === "ko"
        ? `${choice.label}, 좋아요. ${nextStep.question}`
        : `Saved ${choice.label}. ${nextStep.question}`
      : language === "ko"
        ? "필요한 정보가 다 모였어요. 이제 참석 가능한 시간을 확인할게요."
        : "The meeting details are ready. Add each attendee's availability.";
    setMeeting(nextMeeting);
    setCandidates([]);
    setRecommendationComplete(false);
    setInvitationToken("");
    setInvitationLinks([]);
    setInvitationRequestId(crypto.randomUUID());
    setError("");
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: choice.message },
      { id: crypto.randomUUID(), role: "assistant", content: assistantMessage },
    ]);
  }

  async function createInvitation() {
    setInviteLoading(true);
    setInviteError("");
    try {
      const result = await api.createInvitation(meeting, invitationRequestId);
      setInvitationToken(result.token);
      setInvitationLinks(result.links);
      setAvailability((meeting.attendees ?? []).map((attendee) => ({ attendee, status: "no_response" })));
      setLastInviteSyncAt(result.updatedAt);
    } catch (reason) {
      setInviteError(reason instanceof Error ? reason.message : "초대장을 만들지 못했어요.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function refreshInvitationResponses() {
    if (!invitationToken) return;
    setInviteLoading(true);
    setInviteError("");
    try {
      const result = await api.invitationAvailability(invitationToken);
      setAvailability(result.availability);
      setLastInviteSyncAt(result.updatedAt);
      setCandidates([]);
      setRecommendationComplete(false);
    } catch (reason) {
      setInviteError(reason instanceof Error ? reason.message : "새 응답을 확인하지 못했어요.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function confirm() {
    if (!selected) return;
    setConfirmLoading(true);
    setConfirmError("");
    try {
      const result = await api.createEvent(meeting, selected, availability, confirmRequestId, invitationToken || undefined);
      localStorage.removeItem(draftStorageKey);
      await api.deleteDraft().catch(() => undefined);
      onConfirmed(result.event);
    } catch (reason) {
      setConfirmError(reason instanceof Error ? reason.message : "회의 시간을 정하지 못했어요.");
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand />
        <div className="topbar-actions">
          <span className="mode-chip"><span /> 데모 캘린더</span>
          <button className="icon-button mobile-meetings-button" onClick={onShowMeetings} aria-label="내 회의 열기"><CalendarBlank /></button>
          <button className="icon-button" onClick={onSettings} aria-label="설정 열기"><GearSix /></button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <button className="new-chat-button" onClick={restart}><Sparkle /> 새 회의</button>
          <nav aria-label="서비스 상태">
            <p>작업 공간</p>
            <a href="#main-content" className="active"><Robot /> 회의 잡기</a>
            <button onClick={onShowMeetings}><CalendarBlank /> 내 회의</button>
            <button disabled><UsersThree /> 초대받은 회의 <span>준비 중</span></button>
            <button disabled><PlugsConnected /> 캘린더 연결 <span>준비 중</span></button>
          </nav>
          <div className="connection-box">
            <div><PlugsConnected weight="duotone" /><span><strong>데모 캘린더</strong><small>가상 일정 5명 연결</small></span></div>
            <p>실제 캘린더에는 반영되지 않아요.</p>
          </div>
        </aside>

        <main id="main-content" className="conversation">
          <div className="conversation-bar">
              <div><h1>회의 잡기</h1><p>필요한 것만 물어보고, 잘 맞는 시간을 찾아드려요.</p><span className={`draft-sync ${syncStatus}`}>{syncStatus === "saved" ? "저장됐어요" : syncStatus === "saving" || syncStatus === "loading" ? "저장 중" : syncStatus === "conflict" ? "다른 기기에서 바뀌었어요" : "이 기기에 저장했어요"}</span></div>
            <button className="mobile-restart" onClick={restart}>처음부터</button>
          </div>

          <div className="message-stream" aria-live="polite">
            {!online && <div className="offline-banner" role="status"><WifiSlash /><span><strong>인터넷에 연결되지 않았어요</strong> 입력한 내용은 이 기기에 보관하고 있어요.</span></div>}
            {syncStatus === "conflict" && <div className="sync-conflict" role="alert"><span><strong>다른 기기에서 내용이 바뀌었어요</strong> 불러오면 이 화면에서 아직 저장하지 않은 내용은 사라져요.</span><button className="secondary-button" onClick={() => void loadServerDraft()}>새 내용 불러오기</button></div>}
            {messages.map((message) => (
              message.id === "intro" ? (
                <section key={message.id} className="chat-welcome" aria-labelledby="chat-welcome-title">
                  <div className="nodi-orb" aria-hidden="true"><span /><span /><Sparkle weight="fill" /></div>
                  <p>{language === "ko" ? "반가워요. NODI예요." : "Hello, I'm your NODI scheduling assistant."}</p>
                  <h2 id="chat-welcome-title">{language === "ko" ? "어떤 회의를 잡을까요?" : "What meeting should we plan?"}</h2>
                  <small>{language === "ko" ? "몇 가지만 알려주시면 모두에게 잘 맞는 시간을 찾아드려요." : "We'll confirm each condition and find a time that works for the group."}</small>
                </section>
              ) : (
                <article key={message.id} className={`message ${message.role}`}>
                  <span className="avatar" aria-hidden="true">{message.role === "assistant" ? <Robot weight="duotone" /> : <UserCircle weight="duotone" />}</span>
                  <div><span className="message-author">{message.role === "assistant" ? "NODI" : "나"}</span><p>{message.content}</p></div>
                </article>
              )
            ))}
            {!loading && !recommendationComplete && guidedStep?.key === "attendees" && (
              <AttendeePicker
                language={language}
                onConfirm={(attendees) => selectGuidedChoice({
                  label: attendees.join(", "),
                  message: language === "ko" ? `참석 요청 대상은 ${attendees.join(", ")}이야.` : `Invite ${attendees.join(", ")}.`,
                  patch: { attendees },
                })}
                onDirectInput={() => startDirectInput(guidedStep.inputPlaceholder)}
              />
            )}
            {!loading && !recommendationComplete && guidedStep?.key === "availabilityRule" && (
              <RequiredAttendeePicker
                attendees={meeting.attendees ?? []}
                language={language}
                onConfirm={(requiredAttendees) => selectGuidedChoice({
                  label: requiredAttendees.join(", ") || (language === "ko" ? "꼭 참석할 사람 없음" : "No required attendees"),
                  message: language === "ko"
                    ? requiredAttendees.length ? `${requiredAttendees.join(", ")} 모두 꼭 참석해야 해.` : "꼭 참석해야 하는 사람은 없어."
                    : requiredAttendees.length ? `${requiredAttendees.join(", ")} must all be available.` : "No attendee is required to be available.",
                  patch: { requiredAttendees },
                })}
                onDirectInput={() => startDirectInput(guidedStep.inputPlaceholder)}
              />
            )}
            {!loading && !recommendationComplete && (guidedStep?.key === "dateStart" || guidedStep?.key === "dateEnd") && (
              <DateRangePicker
                language={language}
                initialStart={meeting.dateStart}
                onConfirm={(dateStart, dateEnd) => selectGuidedChoice({
                  label: `${dateStart} – ${dateEnd}`,
                  message: language === "ko"
                    ? `일정 탐색 범위는 ${dateStart}부터 ${dateEnd}까지로 할게.`
                    : `Search for meeting times from ${dateStart} through ${dateEnd}.`,
                  patch: { dateStart, dateEnd },
                })}
                onDirectInput={() => startDirectInput(guidedStep.inputPlaceholder)}
              />
            )}
            {!loading && !recommendationComplete && guidedStep && guidedStep.key !== "attendees" && guidedStep.key !== "availabilityRule" && guidedStep.key !== "dateStart" && guidedStep.key !== "dateEnd" && (
              <GuidedChoices
                step={guidedStep}
                onSelect={selectGuidedChoice}
                onDirectInput={startDirectInput}
              />
            )}
            {!loading && !guidedStep && !recommendationComplete && !recommendLoading && (
              <AvailabilityEditor
                responses={availability}
                dateStart={meeting.dateStart!}
                dateEnd={meeting.dateEnd!}
                loading={recommendLoading}
                onChange={setAvailability}
                onSubmit={() => void findRecommendations(meeting, availability)}
                inviteLinks={invitationLinks}
                inviteLoading={inviteLoading}
                inviteError={inviteError}
                lastInviteSyncAt={lastInviteSyncAt}
                onCreateInvite={() => void createInvitation()}
                onRefreshResponses={() => void refreshInvitationResponses()}
              />
            )}
            {loading && (
              <article className="message assistant loading-message" aria-label="NODI가 답변 중입니다">
                <span className="avatar"><Robot weight="duotone" /></span>
                <div><span className="message-author">NODI</span><span className="typing"><i /><i /><i /></span></div>
              </article>
            )}
            {recommendLoading && <div className="recommend-skeleton" role="status" aria-label="추천 시간을 계산하고 있어요"><span /><span /><span /></div>}
            {error && <div className="inline-error" role="alert"><strong>잠시 문제가 생겼어요</strong><span>{error}</span>{lastAction && online && <button className="text-link" onClick={() => lastAction === "chat" ? void send("", true) : void findRecommendations(meeting, availability)}>다시 해보기</button>}</div>}
            {recommendationComplete && (
              <>
                <div className="recommendation-actions"><button className="ghost-button" onClick={() => setRecommendationComplete(false)}>참석 응답 수정</button></div>
                <CandidateList candidates={candidates} onSelect={(candidate) => { setSelected(candidate); setConfirmRequestId(crypto.randomUUID()); }} />
              </>
            )}
            <div ref={endRef} />
          </div>

          <form className="composer" onSubmit={submit}>
            <label htmlFor="chat-input" className="sr-only">메시지 입력</label>
            <textarea
              id="chat-input"
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              placeholder={customPlaceholder || guidedStep?.inputPlaceholder || "편하게 입력해 주세요"}
              disabled={loading}
            />
            <button className="send-button" aria-label="메시지 보내기" disabled={!input.trim() || loading}><ArrowUp weight="bold" /></button>
            <div className="composer-meta">
              <label><Globe /> 언어<select value={language} onChange={(event) => setLanguage(event.target.value as "ko" | "en")}><option value="ko">한국어</option><option value="en">English</option></select></label>
              <label>모델<select value={model} onChange={(event) => setModel(event.target.value)}>{models.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
          </form>
        </main>

        <aside className="context-panel">
          <MeetingSummary meeting={meeting} onChange={(nextMeeting) => {
            setMeeting({ ...nextMeeting, version: (meeting.version ?? 1) + 1 });
            setCandidates([]);
            setRecommendationComplete(false);
            setSelected(null);
            setInvitationToken("");
            setInvitationLinks([]);
            setInvitationRequestId(crypto.randomUUID());
            setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: "바꾼 내용을 반영했어요. 다시 한번 확인해 주세요." }]);
          }} />
          <section className="calendar-status">
            <div className="section-heading"><h2>연결한 캘린더</h2><span>1개</span></div>
            <div className="calendar-provider"><span className="provider-icon"><CalendarBlank /></span><div><strong>Demo Workspace</strong><small>가상 Free/Busy 데이터</small></div><CheckCircle className="provider-check" weight="fill" /></div>
            <div className="calendar-provider upcoming"><span className="provider-icon">G</span><div><strong>Google Calendar</strong><small>아직 연결할 수 없어요</small></div><span>준비 중</span></div>
            <div className="calendar-provider upcoming"><span className="provider-icon">M</span><div><strong>Microsoft 365</strong><small>아직 연결할 수 없어요</small></div><span>준비 중</span></div>
          </section>
        </aside>
      </div>

      <nav className="mobile-bottom-nav" aria-label="모바일 주요 메뉴">
        <button className="active" aria-current="page"><Robot weight="fill" /><span>AI 도우미</span></button>
        <button onClick={onShowMeetings}><CalendarBlank /><span>내 회의</span></button>
        <button disabled><Bell /><span>알림</span></button>
        <button onClick={onSettings}><UserCircle /><span>내 정보</span></button>
      </nav>

      {selected && <ConfirmDialog meeting={meeting} candidate={selected} loading={confirmLoading} error={confirmError} onClose={() => setSelected(null)} onConfirm={() => void confirm()} onRetry={() => { setSelected(null); void findRecommendations(meeting, availability); }} />}
    </div>
  );
}
