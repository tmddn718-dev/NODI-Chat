// 체험(데모)·공개 테스트 모드 여부. 앱이 시작할 때 서버가 알려준 값을 한 번 넣어 두고, 화면 곳곳에서 읽어요.
// mode: groq(개발·API Key 입력) / demo(키 없는 시나리오 체험) / public(키 없는 공개 테스트, 서버 키 AI)
export const demo: { on: boolean; mode: "groq" | "demo" | "public" } = { on: false, mode: "groq" };
