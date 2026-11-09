// 알림 센터(데모): 새로 만든 값이 아니라 앱이 이미 아는 상태(초대받은 회의, 응답 현황)에서만 만들어요.
// 읽음 표시는 이 기기(localStorage)에만 저장돼요. 메일·푸시는 보내지 않아요.
import { slotLabel } from "./format";
import { deadlineLabel, statusOf, type InvitedAnswer, type InvitedMeeting } from "./invited";

export type NodiNotification = { id: string; kind: "invite" | "round" | "confirmed"; title: string; body: string; target: "invited" | "chat" };
export type RoundInfo = { loaded: boolean; invited: boolean; pending: number; total: number };

export function buildNotifications(meetings: InvitedMeeting[], answers: Record<string, InvitedAnswer>, round: RoundInfo, now = Date.now()): NodiNotification[] {
  const list: NodiNotification[] = [];
  for (const meeting of meetings) {
    const status = statusOf(meeting, answers);
    if (status === "pending" && Date.parse(meeting.deadlineAt) > now) {
      list.push({ id: `invite:${meeting.id}`, kind: "invite", target: "invited", title: `${meeting.organizer}님이 '${meeting.title}'에 초대했어요`, body: `${meeting.role} 참석 · ${deadlineLabel(meeting.deadlineAt, now)}` });
    }
  }
  if (round.loaded && round.invited && round.total > 0) {
    list.push(round.pending > 0
      ? { id: `round:pending:${round.pending}`, kind: "round", target: "chat", title: "참석 가능 여부 응답을 기다리고 있어요", body: `${round.pending}명이 아직 응답하지 않았어요` }
      : { id: "round:ready", kind: "round", target: "chat", title: "참석자가 모두 응답했어요", body: "추천 후보를 확인해 보세요" });
  }
  for (const meeting of meetings) {
    if (meeting.confirmed) list.push({ id: `confirmed:${meeting.id}`, kind: "confirmed", target: "invited", title: `'${meeting.title}' 일정이 확정됐어요`, body: `${slotLabel(meeting.confirmed.start)} · ${meeting.durationMinutes}분` });
  }
  return list;
}

const KEY = "nodi_notifications_read_v1";
export function loadRead(): string[] {
  try { const value = JSON.parse(localStorage.getItem(KEY) ?? "[]"); return Array.isArray(value) ? value.filter((item) => typeof item === "string") : []; } catch { return []; }
}
export function saveRead(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids.slice(-100))); } catch { /* 저장소를 쓸 수 없어도 화면은 동작해요 */ }
}
