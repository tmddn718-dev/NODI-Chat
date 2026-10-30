// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureAnalyticsForTests, resetAnalyticsForTests, updateAnalyticsConsent } from "../analytics";
import { readConsent, writeConsent } from "../consent";
import { demo } from "../demo";
import { newRun } from "../flow";

const mocks = vi.hoisted(() => ({ session: vi.fn(), feedback: vi.fn(), events: vi.fn() }));
vi.mock("../api", () => ({
  ApiError: class ApiError extends Error { constructor(message: string, readonly status: number, readonly code?: string) { super(message); } },
  api: { session: mocks.session, feedback: mocks.feedback, events: mocks.events, startDemo: vi.fn() },
}));
import App from "../App";
import { ApiError } from "../api";
import { ConsentNotice } from "./ConsentNotice";
import { FeedbackDialog } from "./FeedbackDialog";
import { SettingsDialog } from "./SettingsDialog";

// 가짜 SDK로 어떤 이벤트가 어떤 속성으로 나가는지 확인해요.
let sent: Array<{ event: string; properties: Record<string, any> }> = [];
let loadCount = 0;
const fakeSdk = () => ({
  init: () => ({ promise: Promise.resolve() }), add: () => ({ promise: Promise.resolve() }), setOptOut: () => undefined, reset: () => undefined,
  track: (event: string, properties: Record<string, any>) => { sent.push({ event, properties }); },
  Types: { LogLevel: { None: 0, Warn: 2 } },
}) as never;
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); sent = []; loadCount = 0;
  demo.on = false; demo.mode = "groq";
  configureAnalyticsForTests({ apiKey: "test_key", enabledInDevelopment: true, load: async () => { loadCount += 1; return fakeSdk(); } });
  mocks.session.mockResolvedValue({ connected: false, models: [], mode: "public" });
  mocks.events.mockResolvedValue({ events: [] });
  mocks.feedback.mockResolvedValue({ saved: true });
  newRun();
});
afterEach(async () => { cleanup(); await resetAnalyticsForTests(); vi.clearAllMocks(); });

describe("first-entry notice and consent", () => {
  it("explains the fictional calendar, AI processing and anonymous analytics, with honest placeholders", () => {
    render(<ConsentNotice onDecide={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: /NODI 테스트/ })).toBeTruthy();
    expect(screen.getByText(/실제 캘린더에는 반영되지 않아요/)).toBeTruthy();
    expect(screen.getByText(/개인정보는 입력하지 마세요/)).toBeTruthy();
    expect(screen.getAllByText("운영자가 별도로 안내해요").length).toBeGreaterThanOrEqual(2); // 보존 기간·문의는 지어내지 않아요
    expect(screen.getByText(/세션 리플레이/)).toBeTruthy();
    expect(screen.getByText(/Amplitude/)).toBeTruthy();
    expect(screen.getByText(/localStorage/)).toBeTruthy(); // 익명 식별자 저장 사실
  });

  it("lets people use the prototype without consenting, and sends nothing", async () => {
    render(<App />);
    expect(await screen.findByRole("dialog", { name: /NODI 테스트/ })).toBeTruthy();
    expect(sent).toHaveLength(0);
    expect(loadCount).toBe(0); // 동의 전에는 SDK를 불러오지도 않아요
    fireEvent.click(screen.getByRole("button", { name: "동의하지 않고 사용" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /NODI 테스트/ })).toBeNull());
    expect(readConsent()?.analytics).toBe(false);
    expect(screen.getByRole("button", { name: "테스트 시작하기" })).toBeTruthy();
    expect(sent).toHaveLength(0);
    expect(loadCount).toBe(0);
    expect(localStorage.getItem("nodi_anon_id")).toBeNull();
  });

  it("starts sending only after consent: the acceptance event first, then one first-visit event", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "동의하고 시작" }));
    await waitFor(() => expect(sent.map((event) => event.event)).toEqual(["analytics_consent_accepted", "prototype_viewed"]));
    expect(sent[0].properties.consent_policy_version).toBe("2026-11-02-amplitude");
    expect(sent[1].properties.entry_context).toBe("direct");
    expect(loadCount).toBe(1); // 한 번만 초기화
  });

  it("does not ask again once decided, and does not show the notice in the dev or demo versions", async () => {
    writeConsent(false);
    const { unmount } = render(<App />);
    expect(await screen.findByRole("button", { name: "테스트 시작하기" })).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /NODI 테스트/ })).toBeNull();
    unmount();
    localStorage.clear();
    mocks.session.mockResolvedValue({ connected: false, models: [], mode: "demo" });
    render(<App />);
    await screen.findByRole("button", { name: "데모 체험 시작하기" });
    expect(screen.queryByRole("dialog", { name: /NODI 테스트/ })).toBeNull();
  });
});

describe("settings: withdrawal and feedback entry", () => {
  it("withdraws consent from settings", () => {
    demo.on = true; demo.mode = "public";
    writeConsent(true);
    const onToggle = vi.fn();
    render(<SettingsDialog onClose={vi.fn()} onDisconnect={vi.fn()} analyticsOn onToggleAnalytics={onToggle} onFeedback={vi.fn()} />);
    expect(screen.getByText(/입력한 문장과 일정 내용은 수집하지 않아요/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "철회하기" }));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: "테스트 데이터 초기화" })).toBeTruthy();
    expect(screen.getByText(/다른 사람의 데이터나 분석 기록에는 영향이 없어요/)).toBeTruthy();
  });
});

describe("feedback", () => {
  const open = () => render(<FeedbackDialog onClose={vi.fn()} />);
  const rate = (group: string, score: number) => {
    const radiogroup = screen.getByRole("radiogroup", { name: group });
    fireEvent.click([...radiogroup.querySelectorAll("button")][score - 1]);
  };

  it("needs both scores, can be skipped, and warns against personal information", () => {
    const onClose = vi.fn();
    render(<FeedbackDialog onClose={onClose} />);
    expect((screen.getByRole("button", { name: "보내기" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/개인정보는 쓰지 말아 주세요/)).toBeTruthy();
    expect((screen.getByLabelText(/자유 의견/) as HTMLTextAreaElement).maxLength).toBe(300);
    fireEvent.click(screen.getByRole("button", { name: "건너뛰기" }));
    expect(onClose).toHaveBeenCalled();
    expect(mocks.feedback).not.toHaveBeenCalled();
  });

  it("submits once even on double click, keeps the comment out of analytics, and clears it after success", async () => {
    await updateAnalyticsConsent(true);
    open();
    rate("전반적으로 만족스러웠나요?", 4);
    rate("일정 조율이 쉬웠나요?", 5);
    fireEvent.click(screen.getByRole("button", { name: "추천 이유가 이해되지 않았어요" }));
    fireEvent.change(screen.getByLabelText(/자유 의견/), { target: { value: "민감한 자유 의견 QQ77" } });
    const send = screen.getByRole("button", { name: "보내기" });
    fireEvent.click(send); fireEvent.click(send);
    expect(await screen.findByText("의견을 보내 주셔서 고마워요")).toBeTruthy();
    expect(mocks.feedback).toHaveBeenCalledTimes(1);
    const body = mocks.feedback.mock.calls[0][0];
    expect(body).toMatchObject({ overallScore: 4, easeScore: 5, tags: ["recommendation_unclear"], comment: "민감한 자유 의견 QQ77", testMode: "fictional_calendar" });
    await waitFor(() => expect(sent.some((event) => event.event === "feedback_submitted")).toBe(true));
    const submitted = sent.find((event) => event.event === "feedback_submitted")!;
    expect(submitted.properties).toMatchObject({ feedback_score: 4, ease_score: 5, feedback_tags: ["recommendation_unclear"] });
    expect(JSON.stringify(sent)).not.toContain(body.runId); // 실행 ID(DB용)는 Amplitude로 가지 않아요
    expect(JSON.stringify(sent)).not.toContain("QQ77"); // 자유 의견 원문은 분석으로 가지 않아요
    expect(screen.queryByDisplayValue("민감한 자유 의견 QQ77")).toBeNull();
    expect(document.body.textContent).not.toContain("QQ77"); // 화면에 다시 보이지도 않아요
  });

  it("sends the opened event once per open, even in StrictMode", async () => {
    await updateAnalyticsConsent(true);
    render(<StrictMode><FeedbackDialog onClose={vi.fn()} /></StrictMode>);
    await waitFor(() => expect(sent.filter((event) => event.event === "feedback_opened")).toHaveLength(1));
    expect(sent.find((event) => event.event === "feedback_opened")!.properties.flow_completed).toBe(false);
  });

  it("shows a clear error and lets people retry", async () => {
    open();
    rate("전반적으로 만족스러웠나요?", 3);
    rate("일정 조율이 쉬웠나요?", 3);
    mocks.feedback.mockRejectedValueOnce(new ApiError("의견을 보내지 못했어요. 잠시 뒤에 다시 해 주세요.", 500, "request_failed"));
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    expect((await screen.findByRole("alert")).textContent).toContain("보내지 못했어요");
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    expect(await screen.findByText("의견을 보내 주셔서 고마워요")).toBeTruthy();
    expect(mocks.feedback).toHaveBeenCalledTimes(2);
  });
});
