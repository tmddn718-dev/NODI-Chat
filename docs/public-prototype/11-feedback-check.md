# 피드백·Supabase 저장 확인

## 저장 구조
- 피드백(점수·태그·자유 의견 300자 이하)과 흐름 요약은 **우리 서버 저장소**에 저장돼요: Supabase(`prototype_feedback`, `prototype_runs`) 또는 로컬 JSONL 파일. 마이그레이션: [`supabase/migrations/0001_prototype_tables.sql`](../../supabase/migrations/0001_prototype_tables.sql).
- **자유 의견은 DB에만** 있어요. Amplitude의 `feedback_submitted`에는 점수·쉬움 점수·태그만 가고, 이벤트는 **DB 저장이 성공한 뒤에만** 나가요.
- `run_id`는 서버 저장소에서 피드백과 흐름 요약을 잇는 값으로만 쓰고 Amplitude에는 보내지 않아요. 한 흐름(run)당 피드백은 1건이에요.

## 확인 방법
1. 한 흐름을 끝내고 피드백을 제출(연타해도 1건).
2. Supabase → Table Editor → `prototype_feedback`에 행이 1개 늘었는지, 자유 의견이 들어 있는지.
3. `prototype_runs`에 같은 `run_id`의 요약(완료 여부·단계·소요·버전)이 있는지.
4. Amplitude User Lookup에서 `feedback_submitted`가 점수·태그만 갖고 있는지(자유 의견·`run_id` 없음).
5. 저장 실패 시(서버 오류) 화면은 재시도를 안내하고, `feedback_submitted`는 나가지 않아야 해요.

## 주의
- 테이블은 RLS가 켜져 있고 정책이 없어 익명 키로는 읽을 수 없어요. 서버의 `SUPABASE_SERVICE_ROLE_KEY`(비밀)로만 접근해요.
- 자유 의견에 개인정보가 들어올 수 있어요. 입력창 아래 안내가 있지만, 읽을 때 개인정보가 보이면 해당 행을 삭제하세요.
