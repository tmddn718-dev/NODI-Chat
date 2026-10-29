import { ArrowLeft, ArrowUp, ArrowDownToLine, MoreHorizontal, ArrowUpToLine, Bot, Calendar, CircleCheck, CircleUser, Globe, Plug, Settings, Users, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api";
import { matchNames } from "../typedNames";
import { MOBILE_QUERY, useMedia } from "../useMedia";
import { getGuidedStep, matchChoice, type GuidedChoice } from "../guided";
import type { AvailabilityResponse, Candidate, NextAction, DraftPayload, InvitationLink, MeetingDraft, MeetingEvent, Message } from "../types";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { NodiMark } from "./NodiMark";
import { pendingInvitedCount } from "../invited";
import { ReviewCard } from "./ReviewCard";
import { AttendeePicker } from "./AttendeePicker";
import { Brand } from "./Brand";
import { CandidateList } from "./CandidateList";
import { ConfirmDialog, type VerifyState } from "./ConfirmDialog";
import { DateRangePicker } from "./DateRangePicker";
import { GuidedChoices } from "./GuidedChoices";
import { MeetingSummary } from "./MeetingSummary";
import { RequiredAttendeePicker } from "./RequiredAttendeePicker";
import { RoundPanel } from "./RoundPanel";
import { ProgressHeader, type EditableField, type ProgressInfo } from "./ProgressParts";
import { AmbiguityResolver, fieldText, ProposalConfirmCard, UnderstoodConditionsCard, type FieldKey, type Understood } from "./UnderstoodCards";

const intro: Message = {
  id: "intro",
  role: "assistant",
  content: "어떤 회의를 잡을까요? 아래에서 골라도 되고, 편하게 입력해도 돼요.",
};

const emptyMeeting = (): MeetingDraft => ({ timezone: "Asia/Seoul", version: 1 });
const draftStorageKey = "nodi_meeting_draft_v2";
const historyStorageKey = "nodi_meeting_history_v1";
const restoreHistory = (): Array<{ meeting: MeetingDraft; messages: Message[] }> => {
  try {
    const saved = JSON.parse(localStorage.getItem(historyStorageKey) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

function restoreDraft() {
  try {
    return JSON.parse(localStorage.getItem(draftStorageKey) ?? "null") as {
      meeting: MeetingDraft;
      availability: AvailabilityResponse[];
      messages: Message[];
      invitationToken?: string;
      invitationLinks?: InvitationLink[];
      invitationRequestId?: string;
      roundToken?: string;
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
  onShowInvited,
  onShowCalendars,
  onConfirmed,
}: {
  models: string[];
  onSettings: () => void;
  onShowMeetings: () => void;
  onShowInvited: () => void;
  onShowCalendars: () => void;
  onConfirmed: (event: MeetingEvent) => void;
}) {
  const [restored] = useState(restoreDraft);
  const [pendingInvited] = useState(pendingInvitedCount);
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
  const [verify, setVerify] = useState<VerifyState>({ state: "checking", message: "" });
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [availability, setAvailability] = useState<AvailabilityResponse[]>(restored?.availability ?? []);
  const [confirmRequestId, setConfirmRequestId] = useState("");
  const [invitationToken, setInvitationToken] = useState(restored?.invitationToken ?? "");
  const [invitationLinks, setInvitationLinks] = useState<InvitationLink[]>(restored?.invitationLinks ?? []);
  const [showTop, setShowTop] = useState(false);
  const streamRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [history, setHistory] = useState<Array<{ meeting: MeetingDraft; messages: Message[] }>>(restoreHistory);
  const [roundToken, setRoundToken] = useState(restored?.roundToken ?? "");
  const [invitationRequestId, setInvitationRequestId] = useState(restored?.invitationRequestId ?? crypto.randomUUID());
  const [undo, setUndo] = useState<{ meeting: MeetingDraft; messages: Message[]; history: Array<{ meeting: MeetingDraft; messages: Message[] }>; reviewed: boolean; label: string } | null>(null);
  const [reviewed, setReviewed] = useState(Boolean(restored?.roundToken || restored?.invitationLinks?.length));
  const [collectMethod, setCollectMethod] = useState<"manual" | "invite">(restored?.invitationLinks?.length ? "invite" : "manual");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [lastInviteSyncAt, setLastInviteSyncAt] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [lastAction, setLastAction] = useState<"chat" | "recommendations" | null>(null);
  const [customPlaceholder, setCustomPlaceholder] = useState("");
  const [recommended, setRecommended] = useState("");
  const [suggestion, setSuggestion] = useState<GuidedChoice | null>(null);
  const [understood, setUnderstood] = useState<Understood | null>(null);
  const [proposal, setProposal] = useState<{ field: FieldKey; value: MeetingDraft[FieldKey]; reason?: string; alternatives?: number[] } | null>(null);
  const [preselect, setPreselect] = useState<{ names: string[]; nonce: number }>({ names: [], nonce: 0 });
  const directoryRef = useRef<Array<{ name: string; email?: string }> | null>(null);
  const [pickPerson, setPickPerson] = useState<Array<{ id: string; label: string }> | null>(null);
  const [meaning, setMeaning] = useState<Extract<NextAction, { type: "resolve_ambiguity" }>["ambiguity"] | null>(null);
  const [roundInfo, setRoundInfo] = useState({ loaded: false, invited: false, pending: 0, total: 0 });
  const [composerOpen, setComposerOpen] = useState(false);
  const isMobile = useMedia(MOBILE_QUERY);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [showAllMessages, setShowAllMessages] = useState(false);
  const [serverReady, setServerReady] = useState(false);
  const epochRef = useRef(0); // 새 대화를 누르면 올라가요. 그 전에 보낸 요청의 늦은 응답은 버려요.
  const [syncStatus, setSyncStatus] = useState<"loading" | "saving" | "saved" | "conflict" | "error">("loading");
  const draftVersionRef = useRef(0);
  const availabilityRef = useRef(availability);
  const endRef = useRef<HTMLDivElement>(null);
  const guidedStep = getGuidedStep(meeting, language);
  const started = messages.length > 1 || Boolean(meeting.title);
  const pendingDecision = !!proposal || !!pickPerson || !!meaning;
  // 긴 대화는 최근 것만 보여주고 이전 대화는 접어요. 현재 결정해야 할 카드가 밀려나지 않게 하려는 거예요.
  const foldable = messages.length > 10 && !showAllMessages;
  const visibleMessages = foldable ? [messages[0], ...messages.slice(-6)] : messages;
  const hiddenCount = foldable ? messages.length - visibleMessages.length : 0;
  // 진행 헤더 모델: 단계(1~4) · 상태 · 다음 행동을 분리해서 계산해요. 응답 대기는 2단계 안의 상태예요.
  const ready = roundInfo.loaded && (roundInfo.total === 0 || (roundInfo.invited && roundInfo.pending === 0));
  const progress: ProgressInfo = selected
    ? { stage: 4, status: "확정 검토", title: "확정 전 일정을 다시 확인해요", helper: "최신 일정을 확인한 뒤 확정해요", next: "확정 조건 확인하기" }
    : roundToken ? (
      ready ? { stage: 3, status: "확인 필요", title: "추천 시간을 비교해 보세요", helper: "추천 근거를 확인하고 시간을 골라 주세요", next: "추천 근거 확인하기" }
      : roundInfo.invited ? { stage: 2, status: "응답 대기", title: "참석 가능 여부를 확인 중이에요", helper: `${roundInfo.pending}명이 아직 응답하지 않았어요`, next: "현재 후보 먼저 확인하기" }
      : { stage: 2, status: "후보 확인 가능", title: "가능한 시간을 찾았어요", helper: "후보를 확인하고, 필요하면 참석 가능 여부를 요청해요", next: "탐색 결과 확인하기" })
    : recommendationComplete ? { stage: 3, status: "확인 필요", title: "추천 시간을 비교해 보세요", helper: "추천 근거를 확인하고 시간을 골라 주세요", next: "추천 근거 확인하기" }
    : reviewed || recommendLoading ? { stage: 2, status: "탐색 중", title: "가능한 시간을 찾고 있어요", helper: "캘린더를 확인하고 있어요", next: "탐색 결과 확인하기" }
    : { stage: 1, status: "입력 중", title: "회의 조건을 정하고 있어요", helper: guidedStep ? `다음 질문 · ${guidedStep.title}` : "조건을 확인해 주세요", next: guidedStep ? `${guidedStep.title} 정하기` : "가능한 시간 찾기" };
  // 모바일에서 선택·추천 작업 중에는 입력창이 주요 버튼과 경쟁하지 않게 한 줄로 줄이고, 눌러야 펼쳐요.
  const selectionTask = guidedStep?.key === "attendees" || guidedStep?.key === "availabilityRule" || guidedStep?.key === "dateStart" || guidedStep?.key === "dateEnd" || Boolean(roundToken) || recommendationComplete;
  const compactComposer = isMobile && selectionTask && !composerOpen && !input && !loading;
  const summaryStatus = selected ? "확정 검토 중" : roundToken && !recommendationComplete ? "참석 응답 확인 중" : recommendationComplete ? "추천 확인 중" : !guidedStep ? "추천 준비 완료" : undefined;
  const requiredCount = meeting.requiredAttendees?.length ?? 0;
  const hasRound = requiredCount > 0 && (meeting.attendees?.length ?? 0) > requiredCount;

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
    const payload: DraftPayload = { meeting, availability, messages, invitationToken: invitationToken || undefined, invitationLinks, invitationRequestId, roundToken: roundToken || undefined, input, language, model };
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
  }, [meeting, availability, messages, invitationToken, invitationLinks, invitationRequestId, roundToken, input, language, model, serverReady, online]);

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
    if (!invitationToken || !online || collectMethod !== "invite") return;
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
  }, [invitationToken, online, collectMethod]);

  useEffect(() => { setComposerOpen(false); }, [guidedStep?.key, roundToken, recommendationComplete]);

  // 모바일 키보드: 키보드가 열리면 하단 탭을 숨기고, 입력창이 가려지지 않게 맨 아래로 맞춰요.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      const open = isMobile && viewport.height < window.innerHeight * 0.75;
      setKeyboardOpen(open);
      if (open) requestAnimationFrame(() => document.getElementById("chat-input")?.scrollIntoView({ block: "end" }));
    };
    viewport.addEventListener("resize", update);
    return () => viewport.removeEventListener("resize", update);
  }, [isMobile]);

  // 위쪽 내용을 읽는 중이면 새 메시지가 와도 강제로 끌어내리지 않고, 맨 아래로 가는 버튼만 보여줘요.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (nearBottomRef.current || last?.role === "user") endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, candidates, loading]);

  function applyDraft(payload: DraftPayload) {
    setMeeting(payload.meeting ?? emptyMeeting());
    setAvailability(payload.availability ?? []);
    setMessages(payload.messages?.length ? payload.messages : [intro]);
    setInvitationToken(payload.invitationToken ?? "");
    setRoundToken(payload.roundToken ?? "");
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

  useEffect(() => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(history));
    } catch {
      // 저장 공간이 없으면 이 기기에서만 되돌리기 기록을 잃는다.
    }
  }, [history]);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), 5000);
    return () => window.clearTimeout(timer);
  }, [undo]);

  // ⌘Z / Ctrl+Z: 바로 전 단계로, ⇧를 함께 누르면 방금 되돌린 것을 다시 적용 (입력창 안에서는 브라우저 기본 동작 유지)
  const shortcutRef = useRef({ goBack: () => {}, undoBack: () => {}, canBack: false });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      const { goBack: back, undoBack: redo, canBack } = shortcutRef.current;
      if (event.shiftKey) redo();
      else if (canBack) back();
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function undoBack() {
    if (!undo) return;
    setMeeting({ ...undo.meeting, version: (meeting.version ?? 1) + 1 });
    setMessages(undo.messages);
    setHistory(undo.history);
    setReviewed(undo.reviewed);
    setCandidates([]);
    setRecommendationComplete(false);
    setSelected(null);
    setUndo(null);
  }

  function goBack() {
    if (recommendationComplete) {
      setRecommendationComplete(false);
      setSelected(null);
      setCandidates([]);
      return;
    }
    const previous = history[history.length - 1];
    if (!previous) return;
    setUndo({ meeting, messages, history, reviewed, label: "이전 단계로 돌아왔어요" });
    setHistory(history.slice(0, -1));
    setReviewed(false);
    setMeeting({ ...previous.meeting, version: (meeting.version ?? 1) + 1 });
    setMessages(previous.messages);
    setCandidates([]);
    setRecommendationComplete(false);
    setSelected(null);
    setInvitationToken("");
    setRoundToken("");
    setInvitationLinks([]);
    setInvitationRequestId(crypto.randomUUID());
    setCustomPlaceholder("");
    setInput("");
    setError("");
  }

  shortcutRef.current = { goBack, undoBack, canBack: !loading && (history.length > 0 || recommendationComplete) };

  // 작성 중인 내용이 있으면 바로 지우지 않고 한 번 확인해요. (되돌리기 바는 그대로 있어요)
  function requestRestart() {
    if (started) { setMoreOpen(false); setConfirmRestart(true); } else restart();
  }

  function restart() {
    setConfirmRestart(false);
    setUndo({ meeting, messages, history, reviewed, label: "처음부터 다시 시작했어요" });
    setHistory([]);
    setReviewed(false);
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
    setRoundToken("");
    setInvitationLinks([]);
    setInvitationRequestId(crypto.randomUUID());
    setInviteError("");
    setLastInviteSyncAt("");
    setLastAction(null);
    // 이해 카드·추천·제안·해석 선택 등 대화 중 임시 상태와 진행 중이던 요청도 함께 비워요.
    epochRef.current += 1;
    setLoading(false);
    setRecommendLoading(false);
    setRecommended("");
    setSuggestion(null);
    setUnderstood(null);
    setProposal(null);
    setPickPerson(null);
    setMeaning(null);
    setCollectMethod("manual");
    setShowAllMessages(false);
    setConfirmError("");
    setSummaryOpen(false);
    localStorage.removeItem(draftStorageKey);
    localStorage.removeItem(historyStorageKey);
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
    const epoch = epochRef.current;
    try {
      const recommendation = await api.recommendations(nextMeeting, responses, (collectMethod === "invite" && invitationToken) || undefined);
      if (epoch !== epochRef.current) return;
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
    const epoch = epochRef.current;
    try {
      const result = await api.chat({
        messages: nextMessages.map(({ role, content: value }) => ({ role, content: value })),
        meeting,
        model,
        language,
        currentField: guidedStep?.key,
      });
      if (epoch !== epochRef.current) return;
      const nextMeeting = { ...(result.meeting ?? meeting), version: (meeting.version ?? 1) + 1 };
      const changed = (result.changedFields ?? []) as FieldKey[];
      const proposedField = (Object.keys(result.proposedFields ?? {})[0] ?? null) as FieldKey | null;
      const options = result.nextAction?.type === "resolve_person" ? result.nextAction.options : null;
      setUnderstood({ changed: changed.map((field) => ({ field, before: meeting[field] === undefined ? undefined : fieldText(field, meeting[field]), beforeValue: meeting[field], after: fieldText(field, nextMeeting[field]) || "삭제" })), issues: result.issues ?? [] });
      setProposal(proposedField ? { field: proposedField, value: result.proposedFields[proposedField] } : null);
      setPickPerson(options);
      const ambiguity = result.nextAction?.type === "resolve_ambiguity" ? result.nextAction.ambiguity : null;
      setMeaning(ambiguity);
      setRecommended("");
      setSuggestion(null);
      // 아무것도 이해하지 못했으면 입력은 그대로 두고, 제시한 목록에서 가장 가까운 항목을 추천해요.
      const nothing = !changed.length && !proposedField && !options && !ambiguity;
      const nearest = nothing && guidedStep ? matchChoice(guidedStep, content).choice : undefined;
      if (nothing && nearest) setRecommended(nearest.label);
      setHistory((current) => [...current, { meeting, messages }].slice(-30));
      setMeeting(nextMeeting);
      setReviewed(false);
      setInvitationToken("");
    setRoundToken("");
      setInvitationLinks([]);
      setInvitationRequestId(crypto.randomUUID());
      setModel(result.model);
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: [result.assistantMessage, nothing
          ? (nearest ? `“${nearest.label}”이 가장 가까워요. 아래 목록에서 골라 주세요.` : "아래 목록에서 골라 주세요.")
          : options ? "한 분을 골라 주세요."
          : ambiguity ? "어떤 뜻인지 아래에서 골라 주세요."
          : proposedField ? "이 값으로 할까요?"
          : getGuidedStep(nextMeeting, language)?.question ?? ""].filter(Boolean).join(" ") },
      ]);
      if (result.complete) setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: "필요한 정보가 다 모였어요. 이제 참석 가능한 시간을 확인할게요." },
      ]);
      setLastAction(null);
    } catch (reason) {
      if (epoch !== epochRef.current) return;
      // 입력은 대화에 남아 있어요. 기술 오류보다 먼저, 현재 질문에 맞는 목록에서 고르게 안내해요.
      const nearest = guidedStep ? matchChoice(guidedStep, content).choice : undefined;
      if (nearest) setRecommended(nearest.label);
      if (guidedStep) setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: `입력한 내용은 보관했어요. 지금은 의미를 정확히 구분하지 못했어요. ${nearest ? `“${nearest.label}”이 가장 가까워요. ` : ""}아래에서 골라 주세요.` }]);
      setError(reason instanceof Error ? reason.message : "메시지를 보내지 못했어요.");
      setLastAction("chat");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const typed = input.trim();
    // 목록 항목과 똑같이 짧게 입력했으면 AI를 거치지 않고 바로 선택해요. 그 밖의 말은 서버가 해석하고 검증해요.
    if (typed && typed.length <= 12 && !loading && !recommendationComplete && guidedStep && !["attendees", "availabilityRule", "dateStart", "dateEnd"].includes(guidedStep.key)) {
      const { choice, exact } = matchChoice(guidedStep, typed);
      if (choice && exact) { setInput(""); setCustomPlaceholder(""); return selectGuidedChoice(choice); }
    }
    // 참석자·꼭 참석 단계에서 이름을 쓰면 AI를 거치지 않고, 목록에서 찾아 카드에 바로 체크해요.
    if (typed && !loading && !recommendationComplete && (guidedStep?.key === "attendees" || guidedStep?.key === "availabilityRule")) {
      void selectTypedNames(typed, guidedStep.key);
      return;
    }
    void send(input);
  }

  async function selectTypedNames(typed: string, key: "attendees" | "availabilityRule") {
    let pool: Array<{ name: string; email?: string }>;
    if (key === "availabilityRule") pool = (meeting.attendees ?? []).map((name) => ({ name }));
    else {
      if (!directoryRef.current) directoryRef.current = await api.people("").then((result) => result.people.map((person) => ({ name: person.name, email: person.email }))).catch(() => []);
      pool = directoryRef.current;
    }
    const { matched, ambiguous, emails } = matchNames(typed, pool);
    const names = key === "attendees" ? [...matched, ...emails] : matched;
    if (!names.length && !ambiguous.length) { void send(typed); return; } // 목록에서 못 찾으면 서버(AI)가 해석해요.
    setInput("");
    setCustomPlaceholder("");
    setPreselect((current) => ({ names, nonce: current.nonce + 1 }));
    const note = [
      names.length ? `${names.join(", ")}님을 ${key === "attendees" ? "참석자로" : "꼭 참석으로"} 체크했어요. 맞으면 아래 버튼으로 계속해 주세요.` : "",
      ambiguous.length ? `“${ambiguous.join(", ")}”은 여러 명이라 직접 골라 주세요.` : "",
    ].filter(Boolean).join(" ");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: typed }, { id: crypto.randomUUID(), role: "assistant", content: note }]);
  }

  function startDirectInput(placeholder: string) {
    setComposerOpen(true);
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
    setRecommended("");
    setSuggestion(null);
    setUnderstood(null);
    setProposal(null);
    setPickPerson(null);
    setMeaning(null);
    setPreselect({ names: [], nonce: 0 });
    setHistory((current) => [...current, { meeting, messages }].slice(-30));
    setMeeting(nextMeeting);
    setReviewed(false);
    setCandidates([]);
    setRecommendationComplete(false);
    setInvitationToken("");
    setRoundToken("");
    setInvitationLinks([]);
    setInvitationRequestId(crypto.randomUUID());
    setError("");
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: choice.message },
      { id: crypto.randomUUID(), role: "assistant", content: assistantMessage },
    ]);
  }

  // 맨 아래(최신 내용)로 이동하고, 이후 새 메시지는 다시 따라가도록 해요.
  function scrollToLatest() {
    const stream = streamRef.current;
    if (!stream) return;
    stream.scrollTo({ top: stream.scrollHeight, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    nearBottomRef.current = true;
    setAwayFromBottom(false);
  }

  // 정한 조건 하나를 지우고 그 질문부터 다시 답해요. 후보와 응답 요청은 조건이 바뀌므로 새로 만들어요.
  function clearField(field: EditableField) {
    setHistory((current) => [...current, { meeting, messages }].slice(-30));
    const next = { ...meeting, version: (meeting.version ?? 1) + 1 } as Record<string, unknown>;
    delete next[field];
    if (field === "attendees") delete next.requiredAttendees;
    if (field === "dateStart") delete next.dateEnd;
    setMeeting(next as MeetingDraft);
    setReviewed(false);
    setRoundToken("");
    setCandidates([]);
    setRecommendationComplete(false);
    setInvitationRequestId(crypto.randomUUID());
    setProposal(null);
    setUnderstood(null);
  }

  // 필수 참석자 조건만 다시 정해요. 나머지 회의 조건은 그대로 두고 후보와 응답 요청은 새로 만들어요.
  function editRequired() {
    setHistory((current) => [...current, { meeting, messages }].slice(-30));
    const next = { ...meeting, requiredAttendees: undefined, version: (meeting.version ?? 1) + 1 };
    setMeeting(next);
    setReviewed(false);
    setRoundToken("");
    setCandidates([]);
    setRecommendationComplete(false);
    setInvitationRequestId(crypto.randomUUID());
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: "필수 참석자를 다시 정해 볼게요. 나머지 조건은 그대로 유지돼요." }]);
  }

  // "이렇게 이해했어요"에서 한 조건만 이전 값으로 되돌려요. 나머지 조건은 그대로예요.
  function revertField(field: FieldKey) {
    const item = understood?.changed.find((entry) => entry.field === field);
    if (!item) return;
    const nextMeeting = { ...meeting, version: (meeting.version ?? 1) + 1 } as Record<string, unknown>;
    if (item.beforeValue === undefined) delete nextMeeting[field]; else nextMeeting[field] = item.beforeValue;
    setHistory((current) => [...current, { meeting, messages }].slice(-30));
    setMeeting(nextMeeting as MeetingDraft);
    setCandidates([]);
    setRecommendationComplete(false);
    setUnderstood({ ...understood!, changed: understood!.changed.filter((entry) => entry.field !== field) });
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

  // 시간을 고르면 바로 확정하지 않고, 서버가 최신 일정을 자동으로 다시 확인한 뒤에만 최종 승인 카드가 열려요.
  async function chooseCandidate(candidate: Candidate) {
    setSelected(candidate);
    setConfirmRequestId(crypto.randomUUID());
    setConfirmError("");
    setVerify({ state: "checking", message: "" });
    const epoch = epochRef.current;
    try {
      const result = await api.verifyCandidate(meeting, candidate, availability, { invitationToken: (collectMethod === "invite" && invitationToken) || undefined, roundToken: roundToken || undefined });
      if (epoch !== epochRef.current) return;
      if (result.status === "ok") {
        setSelected((current) => current && { ...current, checkedAt: result.checkedAt });
        setVerify({ state: "ok", message: result.message });
      } else {
        setVerify({ state: "failed", message: result.message });
      }
    } catch {
      if (epoch !== epochRef.current) return;
      setVerify({ state: "failed", retryable: true, message: "최신 일정을 확인하지 못했어요. 선택한 시간은 그대로 두었어요. 연결을 확인하고 다시 확인해 주세요." });
    }
  }

  async function confirm() {
    if (!selected) return;
    setConfirmLoading(true);
    setConfirmError("");
    try {
      const result = roundToken
        ? await api.confirmRound(roundToken, selected.id, confirmRequestId)
        : await api.createEvent(meeting, selected, availability, confirmRequestId, (collectMethod === "invite" && invitationToken) || undefined);
      localStorage.removeItem(draftStorageKey);
      localStorage.removeItem(historyStorageKey);
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
        <div className="topbar-left">
          {!loading && (history.length > 0 || recommendationComplete) && (
            <button className="topbar-back" onClick={goBack} aria-label="이전 단계로"><ArrowLeft /></button>
          )}
          <Brand />
        </div>
        <div className="topbar-actions">
          <span className="mode-chip"><span /> 데모 캘린더</span>
          <button className="icon-button mobile-meetings-button" onClick={onShowMeetings} aria-label="내 회의 열기"><Calendar /></button>
          <button className="icon-button" onClick={onSettings} aria-label="설정 열기"><Settings /></button>
        </div>
      </header>

      <div className={`workspace ${keyboardOpen ? "kb-open" : ""}`}>
        <aside className="sidebar">
          <button className="new-chat-button" onClick={requestRestart}>새 회의</button>
          <nav aria-label="서비스 상태">
            <p>작업 공간</p>
            <a href="#main-content" className="active"><Bot /> 회의 잡기</a>
            <button onClick={onShowMeetings}><Calendar /> 내 회의</button>
            <button onClick={onShowInvited}><Users /> 초대받은 회의 {pendingInvited > 0 && <span className="nav-count">{pendingInvited}</span>}</button>
            <button onClick={onShowCalendars}><Plug /> 캘린더 연결</button>
          </nav>
          <div className="connection-box">
            <div><Plug /><span><strong>데모 캘린더</strong><small>가상 일정 5명 연결</small></span></div>
            <p>실제 캘린더에는 반영되지 않아요.</p>
          </div>
        </aside>

        <main id="main-content" className="conversation">
          <div className="conversation-bar">
              <div><h1>회의 잡기</h1><p>필요한 것만 물어보고, 잘 맞는 시간을 찾아드려요.</p><span className={`draft-sync ${syncStatus}`}>{syncStatus === "saved" ? "저장됐어요" : syncStatus === "saving" || syncStatus === "loading" ? "저장 중" : syncStatus === "conflict" ? "다른 기기에서 바뀌었어요" : "이 기기에 저장했어요"}</span></div>
            <div className="conversation-actions">
              <button className="summary-toggle" onClick={() => setSummaryOpen(true)} aria-haspopup="dialog" aria-expanded={summaryOpen}>조건 요약</button>
              {isMobile ? (
                <div className="more-menu">
                  <button type="button" className="icon-button" aria-label="더보기" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((value) => !value)}><MoreHorizontal /></button>
                  {moreOpen && (
                    <div className="more-pop" role="menu">
                      <button type="button" role="menuitem" onClick={requestRestart}>새 대화 시작</button>
                    </div>
                  )}
                </div>
              ) : (
                <button className="mobile-restart" onClick={requestRestart}>새 대화</button>
              )}
            </div>
          </div>

          <ProgressHeader info={progress} />

          <div className="message-stream" aria-live="polite" ref={streamRef} onScroll={(event) => { const el = event.currentTarget; setShowTop(el.scrollTop > 240); const near = el.scrollHeight - el.scrollTop - el.clientHeight < 160; nearBottomRef.current = near; setAwayFromBottom(!near); }}>
            {!online && <div className="offline-banner" role="status"><WifiOff /><span><strong>인터넷에 연결되지 않았어요</strong> 입력한 내용은 이 기기에 보관하고 있어요.</span></div>}
            {syncStatus === "conflict" && <div className="sync-conflict" role="alert"><span><strong>다른 기기에서 내용이 바뀌었어요</strong> 불러오면 이 화면에서 아직 저장하지 않은 내용은 사라져요.</span><button className="secondary-button" onClick={() => void loadServerDraft()}>새 내용 불러오기</button></div>}
            {hiddenCount > 0 && <button className="step-fold" onClick={() => setShowAllMessages(true)}>이전 대화 {hiddenCount}개 펼치기</button>}
            {visibleMessages.map((message) => (
              message.id === "intro" ? (
                started ? null : (
                  <section key={message.id} className="chat-welcome" aria-labelledby="chat-welcome-title">
                    <span className="welcome-logo" aria-hidden="true"><NodiMark /></span>
                    <h2 id="chat-welcome-title">{language === "ko" ? "안녕하세요. 어떤 회의를 잡을까요?" : "Hello. What meeting should we plan?"}</h2>
                  </section>
                )
              ) : (
                <article key={message.id} className={`message ${message.role}`}>
                  <span className="avatar" aria-hidden="true">{message.role === "assistant" ? <NodiMark /> : <CircleUser />}</span>
                  <div><span className="message-author">{message.role === "assistant" ? "NODI" : "나"}</span><p>{message.content}</p></div>
                </article>
              )
            ))}
            {!loading && !recommendationComplete && understood && <UnderstoodConditionsCard understood={understood} onRevert={revertField} />}
            {!loading && !recommendationComplete && pickPerson && (
              <AmbiguityResolver options={pickPerson} onPick={(name) => selectGuidedChoice({ label: name, message: `${name}으로 할게.`, patch: { attendees: [...(meeting.attendees ?? []), name] } })} />
            )}
            {!loading && !recommendationComplete && meaning && (
              <AmbiguityResolver title="어떤 뜻으로 말씀하셨는지 확인할게요" options={meaning.options}
                onPick={(id) => { const option = meaning.options.find((item) => item.id === id)!; selectGuidedChoice({ label: option.label, message: option.label, patch: option.patch }); }}
                onDirect={() => { setMeaning(null); startDirectInput(guidedStep?.inputPlaceholder ?? ""); }} />
            )}
            {!loading && !recommendationComplete && proposal && (
              <ProposalConfirmCard field={proposal.field} value={proposal.value} reason={proposal.reason} alternatives={proposal.alternatives}
                onAlternative={(minutes) => selectGuidedChoice({ label: `${minutes}분`, message: `${minutes}분으로 할게.`, patch: { durationMinutes: minutes } })}
                onAccept={() => selectGuidedChoice({ label: fieldText(proposal.field, proposal.value), message: "좋아, 그렇게 할게.", patch: { [proposal.field]: proposal.value } })}
                onDecline={() => { setProposal(null); setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: `알겠어요. 직접 정해 주세요. ${guidedStep?.question ?? ""}`.trim() }]); }} />
            )}
            {!loading && (history.length > 0 || recommendationComplete) && (
              <div className="step-back"><button className="rd-btn m ghost" onClick={goBack} title="이전 단계로 (⌘Z)">이전 단계로</button></div>
            )}
            {!loading && !recommendationComplete && !pendingDecision && guidedStep?.key === "attendees" && (
              <AttendeePicker
                language={language}
                preselect={preselect}
                onConfirm={(attendees) => selectGuidedChoice({
                  label: attendees.join(", "),
                  message: language === "ko" ? `참석 요청 대상은 ${attendees.join(", ")}이야.` : `Invite ${attendees.join(", ")}.`,
                  patch: { attendees },
                })}
                onDirectInput={() => startDirectInput(guidedStep.inputPlaceholder)}
              />
            )}
            {!loading && !recommendationComplete && !pendingDecision && guidedStep?.key === "availabilityRule" && (
              <RequiredAttendeePicker
                preselect={preselect}
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
            {!loading && !recommendationComplete && !pendingDecision && (guidedStep?.key === "dateStart" || guidedStep?.key === "dateEnd") && (
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
            {!loading && !recommendationComplete && suggestion && (
              <div className="reco-bar" role="note">
                <span>이 항목은 어때요?</span>
                <button type="button" onClick={() => selectGuidedChoice(suggestion)}>{suggestion.label}</button>
              </div>
            )}
            {!loading && !recommendationComplete && !pendingDecision && guidedStep && guidedStep.key !== "attendees" && guidedStep.key !== "availabilityRule" && guidedStep.key !== "dateStart" && guidedStep.key !== "dateEnd" && (
              <GuidedChoices
                step={guidedStep}
                onSelect={selectGuidedChoice}
                onDirectInput={startDirectInput}
                recommended={recommended}
              />
            )}
            {!loading && !guidedStep && !reviewed && !recommendationComplete && (
              <ReviewCard meeting={meeting} onEdit={() => setSummaryOpen(true)} onProceed={() => setReviewed(true)} />
            )}
            {!loading && !guidedStep && reviewed && hasRound && (
              <RoundPanel meeting={meeting} token={roundToken} requestId={invitationRequestId} onTokenChange={setRoundToken} onSelect={(candidate) => void chooseCandidate(candidate)} onEditRequired={editRequired} onPhase={setRoundInfo} />
            )}
            {!loading && !guidedStep && reviewed && !hasRound && !recommendationComplete && !recommendLoading && (
              <AvailabilityEditor
                responses={availability}
                dateStart={meeting.dateStart!}
                dateEnd={meeting.dateEnd!}
                loading={recommendLoading}
                onChange={setAvailability}
                onSubmit={() => void findRecommendations(meeting, availability)}
                onMethodChange={setCollectMethod}
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
                <span className="avatar"><NodiMark /></span>
                <div><span className="message-author">NODI</span><span className="typing"><i /><i /><i /></span></div>
              </article>
            )}
            {recommendLoading && <div className="recommend-skeleton" role="status" aria-label="추천 시간을 계산하고 있어요"><span /><span /><span /></div>}
            {error && <div className="inline-error" role="alert"><strong>잠시 문제가 생겼어요</strong><span>{error}</span>{lastAction && online && <button className="text-link" onClick={() => lastAction === "chat" ? void send("", true) : void findRecommendations(meeting, availability)}>다시 해보기</button>}</div>}
            {recommendationComplete && (
              <>
                <div className="recommendation-actions"><button className="ghost-button" onClick={() => setRecommendationComplete(false)}>참석 응답 수정</button></div>
                <CandidateList candidates={candidates} requiredNames={meeting.requiredAttendees ?? []} onSelect={(candidate) => void chooseCandidate(candidate)} />
              </>
            )}
            {undo && <div className="undo-bar" role="status"><span>{undo.label}</span><button onClick={undoBack}>되돌리기</button></div>}
            <div className="to-top-anchor">
              <button type="button" className={`to-top-button to-bottom-button ${awayFromBottom ? "visible" : ""}`} aria-label="최신 내용으로 이동" tabIndex={awayFromBottom ? 0 : -1} onClick={scrollToLatest}><ArrowDownToLine /></button>
              <button type="button" className={`to-top-button ${showTop ? "visible" : ""}`} aria-label="대화 맨 위로" tabIndex={showTop ? 0 : -1} onClick={() => streamRef.current?.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}><ArrowUpToLine /></button>
            </div>
            <div ref={endRef} />
          </div>

          {compactComposer ? (
            <div className="composer composer-compact">
              <button type="button" aria-expanded="false" onClick={() => { setComposerOpen(true); requestAnimationFrame(() => document.getElementById("chat-input")?.focus()); }}>메시지로 입력하기</button>
            </div>
          ) : (
          <form className="composer" onSubmit={submit}>
            <label htmlFor="chat-input" className="sr-only">메시지 입력</label>
            <textarea
              id="chat-input"
              rows={1}
              maxLength={2000}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  submit(event);
                }
              }}
              placeholder={customPlaceholder || guidedStep?.inputPlaceholder || "편하게 입력해 주세요"}
              disabled={loading}
            />
            <button className="send-button" aria-label="메시지 보내기" disabled={!input.trim() || loading}><ArrowUp /></button>
            <div className="composer-meta">
              <label><Globe /> 언어<select value={language} onChange={(event) => setLanguage(event.target.value as "ko" | "en")}><option value="ko">한국어</option><option value="en">English</option></select></label>
            </div>
          </form>
          )}
        </main>

        {summaryOpen && <div className="sheet-scrim" onClick={() => setSummaryOpen(false)} aria-hidden="true" />}
        <aside className={`context-panel ${summaryOpen ? "open" : ""}`} aria-label="회의 조건과 캘린더">
          <button className="sheet-close rd-icon-btn" onClick={() => setSummaryOpen(false)} aria-label="회의 조건 닫기"><X /></button>
          <MeetingSummary meeting={meeting} proposal={proposal} status={summaryStatus} interpreted={understood?.changed.map((item) => `${item.field === "durationMinutes" ? "시간" : item.field === "attendees" ? "참석자" : item.field === "title" ? "회의 종류" : item.field === "purpose" ? "목적" : item.field === "requiredAttendees" ? "꼭 참석" : item.field === "dateStart" || item.field === "dateEnd" ? "날짜" : "선호 시간"} · ${item.after}`)} onEditField={clearField} onChange={(nextMeeting) => {
            setHistory((current) => [...current, { meeting, messages }].slice(-30));
            setMeeting({ ...nextMeeting, version: (meeting.version ?? 1) + 1 });
            setReviewed(false);
            setCandidates([]);
            setRecommendationComplete(false);
            setSelected(null);
            setInvitationToken("");
    setRoundToken("");
            setInvitationLinks([]);
            setInvitationRequestId(crypto.randomUUID());
            setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: "바꾼 내용을 반영했어요. 다시 한번 확인해 주세요." }]);
          }} />
          <section className="calendar-status">
            <div className="section-heading"><h2>연결한 캘린더</h2><span>1개 · <button className="link-button" onClick={onShowCalendars}>관리</button></span></div>
            <div className="calendar-provider"><span className="provider-icon"><Calendar /></span><div><strong>Demo Workspace</strong><small>가상 Free/Busy 데이터</small></div><CircleCheck className="provider-check" /></div>
            <div className="calendar-provider upcoming"><span className="provider-icon">G</span><div><strong>Google Calendar</strong><small>아직 연결할 수 없어요</small></div><span>준비 중</span></div>
            <div className="calendar-provider upcoming"><span className="provider-icon">M</span><div><strong>Microsoft 365</strong><small>아직 연결할 수 없어요</small></div><span>준비 중</span></div>
          </section>
        </aside>
      </div>

      {confirmRestart && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setConfirmRestart(false)}>
          <section className="dialog restart-dialog" role="alertdialog" aria-modal="true" aria-labelledby="restart-title">
            <h2 id="restart-title">새 대화를 시작할까요?</h2>
            <p>지금까지 정한 조건과 대화가 초기화돼요. 시작한 직후에는 “되돌리기”로 복구할 수 있어요.</p>
            <div className="dialog-actions">
              <button className="secondary-button" onClick={() => setConfirmRestart(false)}>계속 작성하기</button>
              <button className="primary-button" onClick={restart}>새로 시작하기</button>
            </div>
          </section>
        </div>
      )}
      {selected && <ConfirmDialog verify={verify} onRecheck={() => void chooseCandidate(selected)} meeting={meeting} candidate={selected} loading={confirmLoading} error={confirmError} onClose={() => setSelected(null)} onConfirm={() => void confirm()} onRetry={() => { setSelected(null); if (!roundToken) void findRecommendations(meeting, availability); }} />}
      <nav className="app-tabbar" aria-label="주요 메뉴">
        <button className="active" aria-current="page"><Bot /><span>회의 잡기</span></button>
        <button onClick={onShowMeetings}><Calendar /><span>내 회의</span></button>
        <button onClick={onShowInvited}><Users /><span>초대{pendingInvited > 0 ? ` ${pendingInvited}` : ""}</span></button>
        <button onClick={onShowCalendars}><Plug /><span>캘린더</span></button>
        <button onClick={onSettings}><Settings /><span>설정</span></button>
      </nav>
    </div>
  );
}
