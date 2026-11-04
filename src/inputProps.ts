// 입력 종류별 키보드 정책: OS 기본 키보드에 "무슨 입력인지"만 알려 주고, 플랫폼이 못 하는 동작은 강제하지 않아요.
// 모두 16px 이상 글자(styles.css)와 함께 써야 iOS가 입력 때 화면을 확대하지 않아요.
export const SEARCH_INPUT = { type: "search", inputMode: "search", enterKeyHint: "search", autoComplete: "off", autoCapitalize: "off", autoCorrect: "off", spellCheck: false } as const;
export const TEXT_INPUT = { enterKeyHint: "done", autoComplete: "off" } as const;
export const NUMBER_INPUT = { inputMode: "numeric", enterKeyHint: "done", autoComplete: "off" } as const;

// 한글 IME 조합 중 Enter는 글자를 확정하는 키라서 "완료/전송"으로 쓰면 마지막 글자가 잘리거나 중복 전송돼요.
export const isComposingEnter = (event: { key: string; nativeEvent?: { isComposing?: boolean; keyCode?: number } }) =>
  event.key === "Enter" && (event.nativeEvent?.isComposing === true || event.nativeEvent?.keyCode === 229);
