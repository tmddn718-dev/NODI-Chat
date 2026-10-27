# NODI Meeting Scheduler

자연어 대화로 회의 정보를 모으고, 데모 캘린더의 Free/Busy 데이터를 이용해 결정적 알고리즘으로 후보 시간을 추천하는 로컬 실행용 MVP입니다.

## 주요 기능

- Groq API Key 연결 테스트와 실제 모델 목록 조회
- `llama-3.3-70b-versatile` 기본 선택, 계정에서 사용할 수 없으면 첫 사용 가능 모델로 대체
- 한국어 및 영어 대화, 회의 필수 정보 추출
- 가상 직원 5명의 일정 충돌을 반영한 후보 시간 3개 계산
- 필수 참석자 일정 미확인 상태를 명확히 표시하고 확정 차단
- 회의 생성, 제목 수정, 취소 시뮬레이션
- 데스크톱, 태블릿, 모바일 반응형 UI와 키보드 포커스 상태
- Google Calendar, Microsoft Graph, iCal, CalDAV 공급자를 추가할 수 있는 인터페이스

## 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:5173](http://localhost:5173)을 열고 Groq Console에서 발급한 API Key를 입력합니다. 프론트엔드는 Vite 개발 서버, API는 `http://localhost:3001`에서 실행됩니다.

프로덕션 빌드 확인:

```bash
npm run build
NODE_ENV=production npm start
```

프로덕션 모드에서는 Node 서버가 `dist` 정적 파일도 함께 제공합니다. 기본 주소는 [http://localhost:3001](http://localhost:3001)입니다.

## 테스트

```bash
npm test
```

테스트는 필수 정보 누락, 중복 참석자 제거, 미확인 필수 참석자 처리, 시간대 선호 점수, 주말 후보 없음 등을 확인합니다. Groq API 오류, 사용량 제한, 응답 형식 오류는 서버에서 사용자용 오류로 변환합니다.

## API Key 보안

- Key는 소스 코드, 브라우저 저장소, 데이터베이스, 로그에 기록하지 않습니다.
- 브라우저에는 `HttpOnly`, `SameSite=Strict` 세션 쿠키만 설정합니다.
- Key는 서버 프로세스 메모리에만 저장되고 연결 해제 또는 4시간 비활성 후 폐기됩니다.
- 서버 재시작 시 모든 세션이 폐기됩니다.
- 이 방식은 로컬 MVP용입니다. 공개 배포 전에는 사용자 인증, 서버 측 세션 저장소, CSRF 방어, 비밀 관리, 요청 제한을 추가해야 합니다.

## 데모 캘린더

`server/demo-data.ts`에 다음 가상 직원이 있습니다.

- 김민지 (`minji@nodi.demo`)
- 박준호 (`junho@nodi.demo`)
- 이소라 (`sora@nodi.demo`)
- Alex Morgan (`alex@nodi.demo`)
- 최유진 (`yujin@nodi.demo`, 일정 조회 불가 상태)

일정 데이터는 2026-10-28부터 2026-10-30까지 준비되어 있습니다. 다른 날짜도 근무 시간 기준 후보를 만들지만 등록된 충돌 일정은 없습니다. 모든 결과는 UI에 `데모 데이터`로 표시되며 실제 초대는 전송하지 않습니다.

## 추천 점수

점수는 `server/recommendation.ts`에서 아래 항목을 고정 가중치로 계산합니다.

- 참석 가능 비율: 최대 65점
- 필수 참석자 가능: 20점
- 선호 시간대 일치: 10점
- 모든 참석자 일정 확인: 5점

AI는 회의 정보를 구조화하고 질문을 만드는 데만 사용합니다. 가능 여부와 점수는 생성하지 않습니다.

## 캘린더 확장

`server/calendar.ts`의 `CalendarProvider`를 구현하면 공급자를 추가할 수 있습니다.

- Google Calendar: OAuth와 Free/Busy, 이벤트 CRUD 구현
- Microsoft 365: Microsoft Graph OAuth와 Schedule, 이벤트 CRUD 구현
- iCal: 읽기 전용 공급자
- CalDAV: 서버 권한에 따른 읽기 및 쓰기 공급자

실제 공급자에서 이벤트 생성 응답을 받은 뒤에만 UI 상태를 확정으로 전환해야 합니다. 현재 미연동 공급자는 성공 상태로 표시하지 않습니다.

## 현재 범위

Slack 및 Teams 채널, 대규모 동시 사용자 처리, 고가용성, 엔터프라이즈 감사 기능은 포함하지 않았습니다. 실제 OAuth 캘린더 연동도 인터페이스와 UI 상태만 준비되어 있습니다.
