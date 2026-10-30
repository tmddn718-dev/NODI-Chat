import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { orgPeople } from "./org-data.ts";
import type { ChangeNotification, MeetingDraft, MeetingEvent, RoundRecord } from "./types.ts";
import type { RoundStore } from "./round.ts";

export type MailMessage = { id: string; to: string; subject: string; text: string };

// 실제 메일 서비스(SMTP·SES 등)는 이 인터페이스만 구현하면 바꿔 끼울 수 있다.
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

// 데모용: 실제로 메일을 보내지 않고 발송함 파일에 기록한다. 같은 id는 한 번만 기록해 중복 발송을 막는다.
export class OutboxMailer implements Mailer {
  private queue = Promise.resolve();

  constructor(private readonly filePath = process.env.NODI_OUTBOX_PATH ?? path.resolve("data/outbox.json")) {}

  send(message: MailMessage) {
    const run = this.queue.catch(() => undefined).then(async () => {
      let items: Array<MailMessage & { sentAt: string }> = [];
      try { items = JSON.parse(await readFile(this.filePath, "utf8")); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      if (items.some((item) => item.id === message.id)) return;
      items.push({ ...message, sentAt: new Date().toISOString() });
      await mkdir(path.dirname(this.filePath), { recursive: true });
      await writeFile(`${this.filePath}.tmp`, JSON.stringify(items, null, 2), { encoding: "utf8", mode: 0o600 });
      await rename(`${this.filePath}.tmp`, this.filePath);
    });
    this.queue = run;
    return run;
  }
}

const norm = (value: string) => value.trim().toLocaleLowerCase("ko-KR").replaceAll(" ", "");

// 이름만으로 주소를 추측하지 않는다. 메일 주소이거나 등록된 사람일 때만 보낸다.
export function emailFor(attendee: string) {
  if (/^\S+@\S+\.\S+$/.test(attendee.trim())) return attendee.trim();
  return orgPeople.find((person) => [person.name, person.id, person.email].some((value) => norm(value) === norm(attendee)))?.email;
}

const when = (iso: string) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(iso));

export async function dispatch(store: RoundStore, mailer: Mailer, record: RoundRecord, kind: "invite" | "reminder", baseUrl: string) {
  const targets = record.participants.filter((p) => kind === "invite" ? p.delivery !== "sent" : p.delivery === "sent" && !p.respondedAt);
  const results = await Promise.all(targets.map(async (participant) => {
    const to = emailFor(participant.attendee);
    if (!to) return { attendee: participant.attendee, ok: false, error: "메일 주소를 확인할 수 없어요" };
    const title = record.meeting.title ?? "회의";
    try {
      await mailer.send({
        id: `${record.id}:${participant.token.slice(0, 12)}:${kind}`,
        to,
        subject: kind === "invite" ? `[NODI] ${title} 참석 가능한 시간을 알려주세요` : `[NODI] ${title} 응답을 기다리고 있어요`,
        text: `${participant.attendee}님, ${title} 후보 시간 중 가능한 시간을 알려주세요.\n응답 마감: ${when(record.deadlineAt)} (한국 표준시)\n${baseUrl}/respond/${participant.token}\n\n고르지 않은 후보는 응답 전으로 남아요.`,
      });
      return { attendee: participant.attendee, ok: true };
    } catch {
      return { attendee: participant.attendee, ok: false, error: "발송하지 못했어요" };
    }
  }));
  return store.recordDelivery(record.token, results, baseUrl, kind === "invite");
}

const fieldNames: Partial<Record<keyof MeetingDraft, string>> = { title: "제목", purpose: "목적", durationMinutes: "시간", attendees: "참석자", dateStart: "시작일", dateEnd: "종료일" };

// 변경 알림. 실제 메일 서비스가 없는 데모에서는 발송함에 기록만 하므로 "전송 완료"가 아니라 "기록됨"으로 돌려줘요.
export async function notifyChange(mailer: Mailer, event: MeetingEvent, targets?: string[]): Promise<ChangeNotification[]> {
  const revision = event.revisions?.at(-1);
  const at = new Date().toISOString();
  const names = (event.meeting.attendees ?? []).filter((name) => !targets || targets.includes(name));
  return Promise.all(names.map(async (attendee): Promise<ChangeNotification> => {
    const to = emailFor(attendee);
    if (!to) return { attendee, status: "failed", reason: "메일 주소를 확인할 수 없어요 · 직접 공유가 필요해요", version: event.version, at };
    const lines = (revision?.changedFields ?? []).map((field) => `${fieldNames[field] ?? field}: ${JSON.stringify(revision!.before[field] ?? "없음")} → ${JSON.stringify(revision!.after[field] ?? "없음")}`);
    try {
      await mailer.send({ id: `${event.id}:v${event.version}:${to}:change`, to, subject: `[NODI] ${event.meeting.title ?? "회의"} 일정이 변경됐어요`, text: `${attendee}님, 회의가 변경됐어요.\n${lines.join("\n")}\n시간: ${when(event.candidate.start)}` });
      return { attendee, status: "recorded", version: event.version, at };
    } catch {
      return { attendee, status: "failed", reason: "발송하지 못했어요", version: event.version, at };
    }
  }));
}
