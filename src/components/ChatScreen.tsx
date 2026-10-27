import {
  ArrowUp,
  CalendarBlank,
  CheckCircle,
  GearSix,
  Globe,
  PlugsConnected,
  Robot,
  Sparkle,
  UserCircle,
} from "@phosphor-icons/react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Candidate, MeetingDraft, MeetingEvent, Message } from "../types";
import { Brand } from "./Brand";
import { CandidateList } from "./CandidateList";
import { ConfirmDialog } from "./ConfirmDialog";
import { MeetingSummary } from "./MeetingSummary";

const quickReplies = ["팀 정기 회의", "프로젝트 킥오프", "업무 리뷰", "1:1 미팅"];
const intro: Message = {
  id: "intro",
  role: "assistant",
  content: "안녕하세요. 어떤 회의를 잡으시나요? 회의 종류를 선택하거나 편하게 입력해 주세요.",
};

export function ChatScreen({
  models,
  onSettings,
  onConfirmed,
}: {
  models: string[];
  onSettings: () => void;
  onConfirmed: (event: MeetingEvent) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([intro]);
  const [meeting, setMeeting] = useState<MeetingDraft>({});
  const [input, setInput] = useState("");
  const [model, setModel] = useState(models.includes("llama-3.3-70b-versatile") ? "llama-3.3-70b-versatile" : models[0] ?? "");
  const [language, setLanguage] = useState<"ko" | "en">("ko");
  const [loading, setLoading] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendationComplete, setRecommendationComplete] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, candidates, loading]);

  function restart() {
    setMessages([intro]);
    setMeeting({});
    setCandidates([]);
    setRecommendationComplete(false);
    setSelected(null);
    setError("");
    setInput("");
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
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
      const nextMeeting = result.meeting ?? meeting;
      setMeeting(nextMeeting);
      setModel(result.model);
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: result.assistantMessage },
      ]);
      if (result.complete) {
        setRecommendLoading(true);
        try {
          const recommendation = await api.recommendations(nextMeeting);
          setCandidates(recommendation.candidates);
          setRecommendationComplete(true);
        } catch (reason) {
          setError(reason instanceof Error ? reason.message : "후보 시간을 찾지 못했습니다.");
        } finally {
          setRecommendLoading(false);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "메시지를 보내지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void send(input);
  }

  async function confirm() {
    if (!selected) return;
    setConfirmLoading(true);
    setConfirmError("");
    try {
      const result = await api.createEvent(meeting, selected);
      onConfirmed(result.event);
    } catch (reason) {
      setConfirmError(reason instanceof Error ? reason.message : "회의를 확정하지 못했습니다.");
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
          <button className="icon-button" onClick={onSettings} aria-label="설정 열기"><GearSix /></button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <button className="new-chat-button" onClick={restart}><Sparkle /> 새 회의 만들기</button>
          <nav aria-label="서비스 상태">
            <p>작업 공간</p>
            <a href="#conversation" className="active"><Robot /> AI 일정 도우미</a>
            <button disabled><CalendarBlank /> 내 회의 <span>준비 중</span></button>
          </nav>
          <div className="connection-box">
            <div><PlugsConnected weight="duotone" /><span><strong>데모 캘린더</strong><small>가상 일정 5명 연결</small></span></div>
            <p>실제 캘린더와 동기화되지 않습니다.</p>
          </div>
        </aside>

        <main id="conversation" className="conversation">
          <div className="conversation-bar">
            <div><h1>AI 일정 도우미</h1><p>필요한 내용만 묻고 후보 시간을 계산합니다.</p></div>
            <button className="mobile-restart" onClick={restart}>대화 재시작</button>
          </div>

          <div className="message-stream" aria-live="polite">
            {messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                <span className="avatar" aria-hidden="true">{message.role === "assistant" ? <Robot weight="duotone" /> : <UserCircle weight="duotone" />}</span>
                <div><span className="message-author">{message.role === "assistant" ? "NODI" : "나"}</span><p>{message.content}</p></div>
              </article>
            ))}
            {messages.length === 1 && (
              <div className="quick-replies" aria-label="빠른 답변">
                {quickReplies.map((reply) => <button key={reply} onClick={() => void send(reply)}>{reply}</button>)}
                <button onClick={() => document.getElementById("chat-input")?.focus()}>직접 입력</button>
              </div>
            )}
            {loading && (
              <article className="message assistant loading-message" aria-label="NODI가 답변 중입니다">
                <span className="avatar"><Robot weight="duotone" /></span>
                <div><span className="message-author">NODI</span><span className="typing"><i /><i /><i /></span></div>
              </article>
            )}
            {recommendLoading && <div className="recommend-skeleton"><span /><span /><span /></div>}
            {error && <div className="inline-error" role="alert"><strong>요청을 완료하지 못했습니다.</strong><span>{error}</span></div>}
            {recommendationComplete && <CandidateList candidates={candidates} onSelect={setSelected} />}
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
              placeholder="예: 다음 주 오전에 민지, 준호와 30분 프로젝트 리뷰 잡아줘"
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
          <MeetingSummary meeting={meeting} />
          <section className="calendar-status">
            <div className="section-heading"><h2>캘린더 연결</h2><span>1개</span></div>
            <div className="calendar-provider"><span className="provider-icon"><CalendarBlank /></span><div><strong>Demo Workspace</strong><small>가상 Free/Busy 데이터</small></div><CheckCircle className="provider-check" weight="fill" /></div>
            <div className="calendar-provider upcoming"><span className="provider-icon">G</span><div><strong>Google Calendar</strong><small>OAuth 연동 준비됨</small></div><span>후속</span></div>
            <div className="calendar-provider upcoming"><span className="provider-icon">M</span><div><strong>Microsoft 365</strong><small>Graph 연동 준비됨</small></div><span>후속</span></div>
          </section>
        </aside>
      </div>

      {selected && <ConfirmDialog meeting={meeting} candidate={selected} loading={confirmLoading} error={confirmError} onClose={() => setSelected(null)} onConfirm={() => void confirm()} />}
    </div>
  );
}
