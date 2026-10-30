# PostHog 수동 정리 (운영자가 직접)

코드·의존성·환경변수·문서·테스트에서는 PostHog를 모두 제거했어요. **PostHog 프로젝트와 거기에 쌓인 데이터는 건드리지 않았어요**(되돌릴 수 없는 작업이라 사용자가 판단해야 해요). 아래를 직접 확인하세요.

- [ ] PostHog에 남은 테스트 이벤트·대시보드를 보존할지 결정(필요하면 먼저 내보내기).
- [ ] 더 이상 쓰지 않으면 PostHog **프로젝트 삭제** 또는 데이터 삭제 요청(삭제하면 복구 불가).
- [ ] PostHog 프로젝트 API Key(`phc_…`)와 개인 API Key가 있으면 폐기.
- [ ] Render `nodi-public`의 `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`, `VITE_ANALYTICS_ENV`가 남아 있으면 삭제(코드는 더 이상 읽지 않아요).
- [ ] PostHog 쪽 퍼널·대시보드·알림 구독 정리.
- [ ] 이전에 접속했던 브라우저의 `ph_*` 저장소: 앱이 첫 로드 때 자동으로 지워요(`cleanupLegacyAnalyticsStorage`). 확인만 하세요.
- [ ] 개인정보 안내(문의처·보존 기간)에서 PostHog 언급이 없는지 확인.

이전 정책 버전으로 동의했던 사용자는 정책 버전이 올라가서 **다시 동의**를 받아요(`2026-11-02-amplitude`).
