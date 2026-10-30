import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api";
import { trackAnalyticsEvent, type FeedbackTag } from "../analytics";
import { anonymousId } from "../consent";
import { deviceInfo } from "../device";
import { experimentVariant } from "../experiment";
import { currentRunId, isRunConfirmed } from "../flow";
import { PROTOTYPE } from "../prototype";

export const FEEDBACK_TAGS: Array<[FeedbackTag, string]> = [
  ["input_hard", "조건 입력이 어려웠어요"], ["participants_hard", "참석자 고르기가 불편했어요"], ["recommendation_unclear", "추천 이유가 이해되지 않았어요"],
  ["confirm_unclear", "확정 단계가 헷갈렸어요"], ["too_slow", "너무 느렸어요"], ["mobile_hard", "모바일에서 쓰기 불편했어요"], ["other", "기타"],
];
const COMMENT_MAX = 300;

function Scale({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <fieldset className="fb-scale">
      <legend>{label}</legend>
      <div role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button key={score} type="button" role="radio" aria-checked={value === score} className={value === score ? "on" : ""} onClick={() => onChange(score)}>{score}</button>
        ))}
      </div>
      <p><span>전혀 아니에요</span><span>매우 그래요</span></p>
    </fieldset>
  );
}

// 짧은 피드백. 점수와 선택 태그만 분석 이벤트로 가고, 자유 의견은 서버 저장소로만 가요(화면·로그에 다시 보여주지 않아요).
export function FeedbackDialog({ onClose }: { onClose: () => void }) {
  const [overall, setOverall] = useState(0);
  const [ease, setEase] = useState(0);
  const [tags, setTags] = useState<FeedbackTag[]>([]);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const sentRef = useRef(false); // 연타해도 한 번만 보내요
  // 개발 모드(StrictMode)에서 효과가 두 번 실행돼도 열 때마다 한 번만 보내요.
  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    trackAnalyticsEvent("feedback_opened", { flow_completed: isRunConfirmed() }, { step: "feedback" });
  }, []);

  async function submit() {
    if (!overall || !ease || sentRef.current) return;
    sentRef.current = true;
    setState("sending");
    setMessage("");
    const id = anonymousId();
    try {
      await api.feedback({
        runId: currentRunId(), overallScore: overall, easeScore: ease, tags, comment: comment.trim() || undefined,
        appVersion: PROTOTYPE.appVersion, flowVersion: PROTOTYPE.flowVersion, experimentId: PROTOTYPE.experiment.id, experimentVariant: id ? experimentVariant(id) : "none",
        testMode: PROTOTYPE.testMode, deviceCategory: deviceInfo().device_category,
      });
      // DB 저장이 성공한 뒤에만, 점수와 선택 태그만 보내요(run_id·자유 의견은 보내지 않아요).
      trackAnalyticsEvent("feedback_submitted", { feedback_score: overall, ease_score: ease, feedback_tags: tags }, { step: "feedback" });
      setComment(""); // 자유 의견은 화면에 남기지 않아요
      setState("done");
    } catch (reason) {
      const already = reason instanceof ApiError && reason.code === "already_submitted";
      sentRef.current = already; // 이미 낸 경우가 아니면 다시 시도할 수 있게 풀어요
      setMessage(reason instanceof Error ? reason.message : "의견을 보내지 못했어요. 잠시 뒤에 다시 해 주세요.");
      setState(already ? "done" : "error");
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && state !== "sending" && onClose()}>
      <section className="dialog feedback" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <button className="dialog-close icon-button" onClick={onClose} aria-label="의견 창 닫기"><X /></button>
        {state === "done" ? (
          <div className="fb-done" role="status">
            <h2 id="feedback-title">의견을 보내 주셔서 고마워요</h2>
            <p>{message || "더 쉬운 일정 조율을 만드는 데 큰 도움이 돼요."}</p>
            <button className="primary-button" onClick={onClose}>닫기</button>
          </div>
        ) : (
          <>
            <h2 id="feedback-title">테스트는 어떠셨나요?</h2>
            <p className="fb-lead">1분이면 돼요. 건너뛰어도 괜찮아요.</p>
            <Scale label="전반적으로 만족스러웠나요?" value={overall} onChange={setOverall} />
            <Scale label="일정 조율이 쉬웠나요?" value={ease} onChange={setEase} />
            <fieldset className="fb-tags">
              <legend>가장 불편했던 부분이 있다면 골라 주세요 (여러 개 가능)</legend>
              <div>{FEEDBACK_TAGS.map(([tag, label]) => (
                <button key={tag} type="button" aria-pressed={tags.includes(tag)} className={tags.includes(tag) ? "on" : ""} onClick={() => setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])}>{label}</button>
              ))}</div>
            </fieldset>
            <label className="fb-comment" htmlFor="fb-comment">자유 의견 (선택)</label>
            <textarea id="fb-comment" value={comment} maxLength={COMMENT_MAX} rows={3} onChange={(event) => setComment(event.target.value)} placeholder="예: 추천 이유를 더 짧게 보고 싶어요" />
            <p className="fb-hint"><span>이름·연락처·회사명 같은 개인정보는 쓰지 말아 주세요.</span><span>{comment.length}/{COMMENT_MAX}</span></p>
            {state === "error" && <p className="dialog-error" role="alert">{message}</p>}
            <div className="dialog-actions">
              <button className="secondary-button" onClick={onClose} disabled={state === "sending"}>건너뛰기</button>
              <button className="primary-button" onClick={() => void submit()} disabled={!overall || !ease || state === "sending"}>{state === "sending" ? "보내는 중..." : "보내기"}</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
