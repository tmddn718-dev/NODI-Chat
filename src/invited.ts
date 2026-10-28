// 초대받은 회의 (데모): 다른 사람이 만든 회의에 내가 초대받은 상황을 흉내 낸 가상 데이터.
// 응답은 이 기기(localStorage)에만 저장해요. 서버나 실제 주최자에게 전달되지 않아요.
export type InvitedSlot = { id: string; start: string; end: string };
export type InvitedMeeting = {
  id: string;
  title: string;
  purpose: string;
  organizer: string;
  organizerTitle: string;
  role: "필수" | "선택";
  durationMinutes: number;
  deadlineAt: string;
  slots: InvitedSlot[];
  confirmed?: InvitedSlot;
};
export type InvitedAnswer = { mode: "pick" | "none" | "unsure"; picks: string[]; answeredAt: string };
export type InvitedStatus = "pending" | "answered" | "confirmed";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const KST = 9 * HOUR;

// 한국 시간 기준 n일 뒤 hour시 정각
function kstAt(now: number, days: number, hour: number) {
  const day = Math.floor((now + KST) / DAY) + days;
  return day * DAY + hour * HOUR - KST;
}
const slot = (id: string, start: number, minutes: number): InvitedSlot => ({ id, start: new Date(start).toISOString(), end: new Date(start + minutes * 60_000).toISOString() });

export function buildInvitedMeetings(now = Date.now()): InvitedMeeting[] {
  return [
    {
      id: "inv-roadmap", title: "분기 로드맵 리뷰", purpose: "다음 분기 우선순위 정리", organizer: "박준호", organizerTitle: "프론트엔드 리드", role: "필수", durationMinutes: 60,
      deadlineAt: new Date(now + 5 * HOUR).toISOString(),
      slots: [slot("a", kstAt(now, 2, 10), 60), slot("b", kstAt(now, 2, 14), 60), slot("c", kstAt(now, 3, 11), 60)],
    },
    {
      id: "inv-design", title: "디자인 시스템 점검", purpose: "컴포넌트 규격 확인", organizer: "이소라", organizerTitle: "시니어 디자이너", role: "선택", durationMinutes: 45,
      deadlineAt: new Date(now + 26 * HOUR).toISOString(),
      slots: [slot("a", kstAt(now, 3, 15), 45), slot("b", kstAt(now, 4, 10), 45)],
    },
    {
      id: "inv-sync", title: "주간 프로덕트 싱크", purpose: "이번 주 진행 상황 공유", organizer: "김민지", organizerTitle: "프로덕트 매니저", role: "필수", durationMinutes: 30,
      deadlineAt: new Date(now - 6 * HOUR).toISOString(),
      slots: [slot("a", kstAt(now, 1, 10), 30)],
      confirmed: slot("a", kstAt(now, 1, 10), 30),
    },
  ];
}

const KEY = "nodi_invited_answers_v1";
export function loadAnswers(): Record<string, InvitedAnswer> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}
export function saveAnswers(answers: Record<string, InvitedAnswer>) {
  try { localStorage.setItem(KEY, JSON.stringify(answers)); } catch { /* 저장소를 쓸 수 없어도 화면은 동작해요 */ }
}
export const statusOf = (meeting: InvitedMeeting, answers: Record<string, InvitedAnswer>): InvitedStatus =>
  meeting.confirmed ? "confirmed" : answers[meeting.id] ? "answered" : "pending";

// 사이드바 배지: 아직 응답하지 않은 초대 수
export function pendingInvitedCount() {
  const answers = loadAnswers();
  return buildInvitedMeetings().filter((meeting) => statusOf(meeting, answers) === "pending").length;
}
