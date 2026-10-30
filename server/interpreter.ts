import { chatWithGroq } from "./groq.ts";
import type { Interpretation } from "./dialogue.ts";
import { orgPeople } from "./org-data.ts";
import { interpretScenario } from "./scenario.ts";
import type { MeetingDraft } from "./types.ts";

// 자연어 해석 단계의 계약. 해석만 하고, 검증·병합·다음 행동은 dialogue.ts가 정한다.
// 새 구현(다른 LLM 등)은 이 인터페이스만 맞추면 바꿔 끼울 수 있다.
export type InterpretInput = {
  apiKey?: string;
  model: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  meeting: MeetingDraft;
  language: "ko" | "en";
  currentField?: string;
};

export interface Interpreter {
  interpret(input: InterpretInput): Promise<Interpretation>;
}

export const groqInterpreter: Interpreter = {
  interpret: ({ apiKey, model, messages, meeting, language, currentField }) =>
    chatWithGroq(apiKey ?? "", model, messages, meeting, language, currentField),
};

// 외부 호출이 없는 체험용 해석기. LLM이 아니라 정해진 규칙으로 읽는다.
export const scenarioInterpreter: Interpreter = {
  interpret: async ({ messages, meeting, currentField }) =>
    interpretScenario(messages.filter((m) => m.role === "user").at(-1)?.content ?? "", meeting, orgPeople, new Date(), currentField),
};

// NODI_MODE=demo 이면 키 없이 체험 모드로, 그 외에는 Groq 모드(기본)로 동작한다.
export type AppMode = "groq" | "demo";
export const appMode: AppMode = process.env.NODI_MODE === "demo" ? "demo" : "groq";
export const interpreterFor = (mode: AppMode): Interpreter => (mode === "demo" ? scenarioInterpreter : groqInterpreter);
