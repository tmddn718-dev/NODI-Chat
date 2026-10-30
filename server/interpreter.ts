import { getConfig } from "./config.ts";
import { chatWithGroq, UpstreamError } from "./groq.ts";
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

// 공개 프로토타입: 서버 환경변수의 키로만 Groq를 호출해요. 모델·출력 토큰·타임아웃은 서버 설정이 정하고, 클라이언트 값은 쓰지 않아요.
export const publicInterpreter: Interpreter = {
  interpret: ({ messages, meeting, language, currentField }) => {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) throw new UpstreamError("AI 연결 설정이 아직 끝나지 않았어요. 운영자가 설정하면 이용할 수 있어요.", 503, "ai_not_configured");
    const config = getConfig();
    return chatWithGroq(apiKey, config.groqModel, messages, meeting, language, currentField, { maxTokens: config.groqMaxOutputTokens, timeoutMs: config.groqRequestTimeoutMs });
  },
};

// 외부 호출이 없는 체험용 해석기. LLM이 아니라 정해진 규칙으로 읽는다.
export const scenarioInterpreter: Interpreter = {
  interpret: async ({ messages, meeting, currentField }) =>
    interpretScenario(messages.filter((m) => m.role === "user").at(-1)?.content ?? "", meeting, orgPeople, new Date(), currentField),
};

// NODI_MODE=demo 이면 키 없이 체험 모드로, 그 외에는 Groq 모드(기본)로 동작한다.
// NODI_MODE=public 이면 키 없이 시작하는 공개 테스트로, 해석은 서버 키 Groq가 맡아요.
export type AppMode = "groq" | "demo" | "public";
export const appMode: AppMode = process.env.NODI_MODE === "demo" ? "demo" : process.env.NODI_MODE === "public" ? "public" : "groq";
export const interpreterFor = (mode: AppMode): Interpreter => (mode === "demo" ? scenarioInterpreter : mode === "public" ? publicInterpreter : groqInterpreter);
