# CLAUDE.md · 광고 모델 추천 에이전트

이 레포에서 코드를 쓰거나 고치는 AI(Claude 등)와 개발자가 따르는 규칙입니다.
제품 요구사항은 `PRD.md`, 실습 공통 규칙은 `AGENTS.md`를 함께 봅니다. 두 문서와 충돌하면 이 문서가 우선합니다.

## 스택

- Next.js 16 (App Router) · TypeScript · React 19
- OpenAI Responses API (`openai` SDK), 웹 검색은 내장 `web_search` 도구
- Supabase (`@supabase/supabase-js`, publishable key + RLS)
- 선택: YouTube Data API v3 (읽기 전용)

## 반드시 지킬 규칙

### 1. 에이전트 루프

- 루프는 반드시 `MAX_STEPS`를 포함합니다. 값은 `src/lib/shared.ts`에서만 바꾸고, 늘리기 전에 비용과 종료 조건을 확인합니다.
- **루프 뼈대는 임의로 수정하지 않습니다.** `src/agent/runAgent.ts`의 `for` 루프, `responses.create` 호출 흐름, `call_id` ↔ `function_call_output` 연결, 대화 기록을 이어 붙이는 방식은 그대로 둡니다.
- 바꿔야 할 이유가 생기면 코드를 고치기 전에 무엇을 왜 바꾸는지 먼저 설명하고 승인을 받습니다.
- 도구별 동작과 검증은 루프 바깥의 `executeTool`과 `src/tools/`에서 처리합니다.

### 2. 도구 분리

- 도구는 `src/tools/` 폴더에 **파일 하나에 도구 하나**로 분리합니다.
  - `searchCreators.ts`, `getCreatorStats.ts`, `saveShortlist.ts`
  - 공용 헬퍼: `webSearch.ts`, `youtube.ts`
- 도구 스키마는 `src/tools/definitions.ts`에 모으고, `runAgent.ts`의 `executeTool`에 명시적으로 등록합니다.
- DB와 외부 API 접근은 `src/tools/`의 서버 전용 함수(`import "server-only"`)에서만 합니다.
- 도구는 읽기 위주로 두고, **쓰기 도구는 `save_shortlist` 1개만** 둡니다.

### 3. 로그

- 모든 도구 호출은 서버 터미널에 아래 형식으로 한 줄씩 남깁니다.

  ```text
  [step N] 도구명(인자)
  [step 3] search_creators(platform=youtube, keywords=비건 뷰티, 민감성 피부)
  [step 7] get_creator_stats(platform=instagram, handle=@creator_id)
  ```

- 결과도 한 줄로 남깁니다 (예: `→ 팔로워 125,000` / `→ 거절: 확인되지 않은 후보`).
- 화면의 "실행 로그"에도 같은 단계를 표시합니다.
- 로그에 API 키, 토큰, 개인 연락처를 남기지 않습니다. 외부 API 오류 본문에 키가 섞일 수 있으므로 상태 코드만 기록합니다.

### 4. 쓰기 도구는 실행 전 사람 확인

- `save_shortlist`는 **사람이 승인하기 전에는 실행하지 않습니다.**
- 웹 화면에서는 에이전트가 순위안을 만들면 미리보기를 띄우고 멈춥니다. **저장(y)** 을 눌러야 저장하고, **취소(n)** 를 누르면 저장하지 않고 종료합니다.
- 터미널 스크립트로 실행할 때는 `저장할까요? (y/n)`을 묻고 `y`일 때만 저장합니다.
- 승인은 한 번의 저장에만 유효합니다. 저장은 실행당 1회만 허용합니다.

### 5. 근거와 출처

- **도구 결과에 없는 내용은 쓰지 않습니다.** 크리에이터 이름, 핸들, 팔로워, 조회수, URL을 모델이 만들어내면 안 됩니다.
- 저장되는 지표(이름, URL, 팔로워, 평균 조회수)는 모델의 인자가 아니라 `get_creator_stats`가 확인한 값만 씁니다.
- 출처를 붙입니다. 웹 검색에 실제로 인용된 URL과 YouTube 채널 URL만 `sources`에 넣습니다.
- **못 찾은 값은 "찾지 못함"이라고 씁니다.** 숫자를 추정하거나 비워 두지 않습니다.
- 지표를 확인하지 않은 후보는 순위에 넣을 수 없고, 서버에서 거절합니다.

### 6. 하지 않을 것 (도구로도 만들지 않음)

- 크리에이터에게 연락하는 기능 (DM, 이메일, 댓글, 문의 폼 제출)
- 비공개 개인정보 수집 (개인 연락처, 실명, 거주지)
- 결제, 계약, 유료 서비스 가입
- 저장된 리스트의 수정·삭제, 사용자가 요청하지 않은 배포·스키마 적용

### 7. 작업 방식

- **한 번에 한 단계만 구현합니다.** 여러 기능을 한꺼번에 바꾸지 않습니다.
- 각 단계를 마치면 아래를 알려줍니다.
  1. 바꾼 파일과 이유
  2. 실행 방법 (`npm run check:env`, `npm run dev`, 확인할 화면과 로그)
  3. 성공했는지 확인하는 방법 (`PRD.md`의 성공 기준 중 해당 번호)
- 구현 후 `npm run typecheck`가 통과해야 다음 단계로 넘어갑니다.
- DB 구조를 바꾸면 `supabase/schema.sql`과 `supabase/seed.sql`을 함께 갱신합니다.

## 비밀값

- OpenAI 키, YouTube 키는 서버 환경변수로만 읽고 `NEXT_PUBLIC_` 접두어를 붙이지 않습니다.
- 공개 가능한 값은 Supabase URL과 publishable key뿐입니다. 서비스 롤 키는 쓰지 않습니다.

## 환경 체크

`npm run check:env`는 아래를 모두 확인하고 각각 OK/실패를 출력해야 합니다. 비밀값 자체는 출력하지 않습니다.

1. 필수 환경변수 존재: `OPENAI_API_KEY`, `OPENAI_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
2. OpenAI 호출: 설정한 모델로 짧은 요청 1회
3. Supabase 연결: `creator_shortlists` 테이블에 접근 가능한지 확인 (익명 키는 조회 권한이 없으므로, 권한 오류와 연결·테이블 없음 오류를 구분해서 판정)
4. 선택: `YOUTUBE_API_KEY`가 있으면 YouTube API 호출 1회

## 파일 위치

```text
src/agent/runAgent.ts        # 루프 (뼈대 수정 금지) + executeTool 규칙 검증
src/tools/                   # 도구 파일, 스키마(definitions.ts), 헬퍼
src/config/demo.ts           # 모델, 목표 문장, 에이전트 지침, 검색 프롬프트
src/lib/shared.ts            # MAX_STEPS, 후보 수, 최소 팔로워, 플랫폼
src/app/api/agent/route.ts   # 입력 검증, 요청 제한
src/components/AgentDemo.tsx # 입력, 실행 로그, 순위 미리보기
scripts/check-env.mjs        # 환경 체크
supabase/schema.sql          # creator_shortlists 테이블 (insert 전용 RLS)
PRD.md                       # 목표, 도구, 성공 기준
```
