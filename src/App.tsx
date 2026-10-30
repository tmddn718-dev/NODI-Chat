import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { ChatScreen } from "./components/ChatScreen";
import { DemoRibbon } from "./components/DemoRibbon";
import { ConnectScreen } from "./components/ConnectScreen";
import { CandidateInviteScreen } from "./components/CandidateInviteScreen";
import { InviteResponseScreen } from "./components/InviteResponseScreen";
import { CalendarConnections } from "./components/CalendarConnections";
import { InvitedMeetings } from "./components/InvitedMeetings";
import { initializeAnalyticsAfterConsent, trackAnalyticsEvent, updateAnalyticsConsent, withdrawAnalyticsConsent } from "./analytics";
import { ConsentNotice } from "./components/ConsentNotice";
import { FeedbackDialog } from "./components/FeedbackDialog";
import { cleanupLegacyAnalyticsStorage, readConsent } from "./consent";
import { demo } from "./demo";
import { flowAbandoned, newRun } from "./flow";
import { MeetingManager } from "./components/MeetingManager";
import { MeetingsList } from "./components/MeetingsList";
import { SettingsDialog } from "./components/SettingsDialog";
import type { MeetingDraft, MeetingEvent } from "./types";

type View = "loading" | "connect" | "chat" | "meetings" | "event" | "invited" | "calendars";

export default function App() {
  return <><DemoRibbon /><Screens /></>;
}

function Screens() {
  const inviteToken = window.location.pathname.match(/^\/invite\/([a-f0-9]{48})\/?$/)?.[1];
  const roundToken = window.location.pathname.match(/^\/respond\/([a-f0-9]{48})\/?$/)?.[1];
  const [view, setView] = useState<View>("loading");
  const [models, setModels] = useState<string[]>([]);
  const [settings, setSettings] = useState(false);
  const [event, setEvent] = useState<MeetingEvent | null>(null);
  const [events, setEvents] = useState<MeetingEvent[]>([]);
  const [notice, setNotice] = useState("");
  const [slowBoot, setSlowBoot] = useState(false);
  // 이전 분석 도구(PostHog)가 남긴 저장값과 이전 정책의 동의는 지우고 시작해요(분석 도구가 바뀌어 다시 동의를 받아요).
  const [consent, setConsent] = useState(() => { cleanupLegacyAnalyticsStorage(); return readConsent(); });
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const viewedRef = useRef(false);

  // 분석 동의: 처음 한 번 정하고, 설정에서 철회할 수 있어요. 거부는 로컬에만 기록하고 Amplitude에는 아무것도 보내지 않아요.
  // 철회하면 즉시 추적을 멈추고 대기 중인 이벤트와 식별자를 지워요.
  function decide(analytics: boolean) {
    void updateAnalyticsConsent(analytics);
    setConsent(readConsent());
  }
  function toggleAnalytics(analytics: boolean) {
    if (analytics) void updateAnalyticsConsent(true);
    else withdrawAnalyticsConsent();
    setConsent(readConsent());
  }

  // 이미 동의한 사용자가 다시 들어오면 SDK를 초기화해요(동의하지 않았다면 아무 일도 하지 않아요).
  useEffect(() => { if (consent?.analytics === true) void initializeAnalyticsAfterConsent(); }, [consent?.analytics]);

  // 공개 테스트 첫 진입(동의한 경우에만). 같은 페이지 로드에서 한 번만 보내요.
  useEffect(() => {
    if (demo.mode !== "public" || consent?.analytics !== true || view === "loading" || viewedRef.current) return;
    viewedRef.current = true;
    let entry: "direct" | "internal" | "external" = "direct";
    try { if (document.referrer) entry = new URL(document.referrer).origin === window.location.origin ? "internal" : "external"; } catch { entry = "direct"; }
    trackAnalyticsEvent("prototype_viewed", { entry_context: entry }, { step: "consent" });
  }, [consent, view]);

  // 시작했지만 확정하지 못한 채 페이지가 닫히면 이탈로 기록해요(근사치).
  useEffect(() => {
    const onHide = () => flowAbandoned("page_hidden");
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  // 서버가 다시 켜졌거나 세션이 끝나면 연결 화면으로 돌아가고, 이유와 보관 상태를 알려줘요.
  useEffect(() => {
    const onExpired = () => {
      setSettings(false);
      setNotice(demo.on
        ? "체험이 끝났어요. 서버가 다시 시작됐거나 오래 쉬었을 수 있어요. 아래 버튼으로 새로 시작해 주세요."
        : "연결이 끊겼어요. 서버가 다시 시작됐거나 오래 쉬었을 수 있어요. 입력하던 회의는 이 기기에 보관돼 있으니, 같은 키로 다시 연결하면 이어서 할 수 있어요.");
      setView("connect");
    };
    window.addEventListener("nodi:session-expired", onExpired);
    return () => window.removeEventListener("nodi:session-expired", onExpired);
  }, []);

  // 무료 서버는 잠들어 있다가 첫 접속에 오래 걸릴 수 있어요.
  useEffect(() => {
    if (view !== "loading") return;
    const timer = window.setTimeout(() => setSlowBoot(true), 4000);
    return () => window.clearTimeout(timer);
  }, [view]);

  useEffect(() => {
    if (inviteToken || roundToken) return;
    api.session()
      .then(async (session) => {
        demo.mode = session.mode ?? "groq";
        demo.on = demo.mode !== "groq";
        window.dispatchEvent(new Event("nodi:demo"));
        setModels(session.models);
        if (session.connected) setEvents((await api.events()).events);
        setView(session.connected ? "chat" : "connect");
      })
      .catch(() => setView("connect"));
  }, [inviteToken, roundToken]);

  async function connect(key: string) {
    const session = await api.connect(key);
    setModels(session.models);
    setEvents((await api.events()).events);
    setNotice("");
    setView("chat");
  }

  async function startDemo() {
    const session = await api.startDemo();
    setModels(session.models);
    setEvents((await api.events()).events);
    setNotice("");
    setView("chat");
  }

  async function disconnect() {
    // 테스트 데이터 초기화는 명시적으로 다시 시작하는 거라 이탈로 기록하고, 새 실행 ID로 시작해요(익명 세션 ID는 그대로예요).
    flowAbandoned("restart");
    newRun();
    await api.disconnect();
    setSettings(false);
    setEvent(null);
    setModels([]);
    setView("connect");
  }

  async function updateEvent(patch: Partial<MeetingDraft>, notify: "now" | "none") {
    if (!event) return;
    const result = await api.updateEvent(event.id, { ...event.meeting, ...patch }, notify);
    setEvent(result.event);
    setEvents((current) => current.map((item) => item.id === result.event.id ? result.event : item));
  }

  async function retryNotifications() {
    if (!event) return;
    const result = await api.retryNotifications(event.id);
    setEvent(result.event);
    setEvents((current) => current.map((item) => item.id === result.event.id ? result.event : item));
  }

  async function cancelEvent() {
    if (!event) return;
    await api.cancelEvent(event.id);
    const cancelled = { ...event, status: "cancelled" as const, version: event.version + 1, updatedAt: new Date().toISOString() };
    setEvent(cancelled);
    setEvents((current) => current.map((item) => item.id === cancelled.id ? cancelled : item));
  }

  if (roundToken) return <CandidateInviteScreen token={roundToken} />;
  if (inviteToken) return <InviteResponseScreen token={inviteToken} />;
  const content = (() => {
  if (view === "loading") {
    return <main id="main-content" className="boot-screen" aria-label="NODI 불러오는 중"><span className="boot-logo">N</span><div className="boot-line" />{slowBoot && <p className="boot-hint" role="status">서버를 깨우고 있어요. 처음에는 최대 1분 정도 걸릴 수 있어요.</p>}</main>;
  }
  if (view === "connect") return <ConnectScreen onConnect={connect} onStartDemo={demo.on ? startDemo : undefined} notice={notice} />;
  if (view === "invited") return <InvitedMeetings onBack={() => setView("chat")} />;
  if (view === "calendars") return <CalendarConnections onBack={() => setView("chat")} />;
  if (view === "meetings") {
    return <MeetingsList events={events} onSelect={(selected) => { setEvent(selected); setView("event"); }} onBack={() => setView("chat")} onNew={() => setView("chat")} />;
  }
  if (view === "event" && event) {
    return <MeetingManager event={event} onUpdate={updateEvent} onRetryNotify={retryNotifications} onCancel={cancelEvent} onBack={() => setView("meetings")} onNew={() => { setEvent(null); setView("chat"); }} onFeedback={demo.mode === "public" ? () => setFeedbackOpen(true) : undefined} />;
  }
  return (
    <>
      <ChatScreen models={models} onSettings={() => setSettings(true)} onShowMeetings={() => setView("meetings")} onShowInvited={() => setView("invited")} onShowCalendars={() => setView("calendars")} onConfirmed={(confirmed) => { setEvent(confirmed); setEvents((current) => [confirmed, ...current.filter((item) => item.id !== confirmed.id)]); setView("event"); }} />
      {settings && <SettingsDialog onClose={() => setSettings(false)} onDisconnect={disconnect} analyticsOn={consent?.analytics === true} onToggleAnalytics={toggleAnalytics} onFeedback={() => { setSettings(false); setFeedbackOpen(true); }} />}
    </>
  );
  })();
  const overlays = (
    <>
      {demo.mode === "public" && view !== "loading" && consent === null && <ConsentNotice onDecide={decide} />}
      {feedbackOpen && <FeedbackDialog onClose={() => setFeedbackOpen(false)} />}
    </>
  );
  return <>{content}{overlays}</>;
}
