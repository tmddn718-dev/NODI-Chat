import { useEffect, useState } from "react";
import { api } from "./api";
import { ChatScreen } from "./components/ChatScreen";
import { ConnectScreen } from "./components/ConnectScreen";
import { MeetingManager } from "./components/MeetingManager";
import { SettingsDialog } from "./components/SettingsDialog";
import type { MeetingEvent } from "./types";

type View = "loading" | "connect" | "chat" | "event";

export default function App() {
  const [view, setView] = useState<View>("loading");
  const [models, setModels] = useState<string[]>([]);
  const [settings, setSettings] = useState(false);
  const [event, setEvent] = useState<MeetingEvent | null>(null);

  useEffect(() => {
    api.session()
      .then((session) => {
        setModels(session.models);
        setView(session.connected ? "chat" : "connect");
      })
      .catch(() => setView("connect"));
  }, []);

  async function connect(key: string) {
    const session = await api.connect(key);
    setModels(session.models);
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
  }

  async function cancelEvent() {
    if (!event) return;
    await api.cancelEvent(event.id);
    setEvent({ ...event, status: "cancelled" });
  }

  if (view === "loading") {
    return <main className="boot-screen" aria-label="NODI 불러오는 중"><span className="boot-logo">N</span><div className="boot-line" /></main>;
  }
  if (view === "connect") return <ConnectScreen onConnect={connect} />;
  if (view === "event" && event) {
    return <MeetingManager event={event} onUpdate={updateEvent} onCancel={cancelEvent} onNew={() => { setEvent(null); setView("chat"); }} />;
  }
  return (
    <>
      <ChatScreen models={models} onSettings={() => setSettings(true)} onConfirmed={(confirmed) => { setEvent(confirmed); setView("event"); }} />
      {settings && <SettingsDialog onClose={() => setSettings(false)} onDisconnect={disconnect} />}
    </>
  );
}
