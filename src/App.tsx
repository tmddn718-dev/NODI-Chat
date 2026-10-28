import { useEffect, useState } from "react";
import { api } from "./api";
import { ChatScreen } from "./components/ChatScreen";
import { ConnectScreen } from "./components/ConnectScreen";
import { CandidateInviteScreen } from "./components/CandidateInviteScreen";
import { InviteResponseScreen } from "./components/InviteResponseScreen";
import { CalendarConnections } from "./components/CalendarConnections";
import { InvitedMeetings } from "./components/InvitedMeetings";
import { MeetingManager } from "./components/MeetingManager";
import { MeetingsList } from "./components/MeetingsList";
import { SettingsDialog } from "./components/SettingsDialog";
import type { MeetingEvent } from "./types";

type View = "loading" | "connect" | "chat" | "meetings" | "event" | "invited" | "calendars";

export default function App() {
  const inviteToken = window.location.pathname.match(/^\/invite\/([a-f0-9]{48})\/?$/)?.[1];
  const roundToken = window.location.pathname.match(/^\/respond\/([a-f0-9]{48})\/?$/)?.[1];
  const [view, setView] = useState<View>("loading");
  const [models, setModels] = useState<string[]>([]);
  const [settings, setSettings] = useState(false);
  const [event, setEvent] = useState<MeetingEvent | null>(null);
  const [events, setEvents] = useState<MeetingEvent[]>([]);

  useEffect(() => {
    if (inviteToken || roundToken) return;
    api.session()
      .then(async (session) => {
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
    setView("chat");
  }

  async function disconnect() {
    await api.disconnect();
    setSettings(false);
    setEvent(null);
    setModels([]);
    setView("connect");
  }

  async function updateEvent(title: string) {
    if (!event) return;
    const result = await api.updateEvent(event.id, { ...event.meeting, title });
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
  if (view === "loading") {
    return <main id="main-content" className="boot-screen" aria-label="NODI 불러오는 중"><span className="boot-logo">N</span><div className="boot-line" /></main>;
  }
  if (view === "connect") return <ConnectScreen onConnect={connect} />;
  if (view === "invited") return <InvitedMeetings onBack={() => setView("chat")} />;
  if (view === "calendars") return <CalendarConnections onBack={() => setView("chat")} />;
  if (view === "meetings") {
    return <MeetingsList events={events} onSelect={(selected) => { setEvent(selected); setView("event"); }} onBack={() => setView("chat")} onNew={() => setView("chat")} />;
  }
  if (view === "event" && event) {
    return <MeetingManager event={event} onUpdate={updateEvent} onCancel={cancelEvent} onBack={() => setView("meetings")} onNew={() => { setEvent(null); setView("chat"); }} />;
  }
  return (
    <>
      <ChatScreen models={models} onSettings={() => setSettings(true)} onShowMeetings={() => setView("meetings")} onShowInvited={() => setView("invited")} onShowCalendars={() => setView("calendars")} onConfirmed={(confirmed) => { setEvent(confirmed); setEvents((current) => [confirmed, ...current.filter((item) => item.id !== confirmed.id)]); setView("event"); }} />
      {settings && <SettingsDialog onClose={() => setSettings(false)} onDisconnect={disconnect} />}
    </>
  );
}
