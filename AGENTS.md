# Session 09 · 광고 모델 추천 에이전트

이 레포는 LLM이 도구를 선택하고, 우리 코드가 도구를 실행한 뒤, 결과를 다시 LLM에 전달하는 흐름을 보여주는 실습 템플릿입니다.

## 에이전트 목표

> 사용자가 제품 설명과 타깃 고객을 입력하면, 웹 검색과 공개 데이터로 인스타그램·유튜브·틱톡에서 팔로워 1만 명 이상(마이크로 이상)인 국내 크리에이터 후보를 찾아 지표를 확인하고, 제품과의 적합 근거를 기준으로 상위 5명을 1~5위로 순위를 매긴 추천 리스트 1건을 저장하면 종료한다. 확인하지 못한 지표는 지어내지 않고 "확인 불가"로 남긴다.

목표를 바꿀 때는 `src/config/demo.ts`의 `AGENT_INSTRUCTIONS`, `src/tools/definitions.ts`의 개수 제한, `runAgent.ts`의 검증 로직을 함께 맞추세요.

## 수정 규칙

- `src/agent/runAgent.ts`의 도구 호출 루프와 `call_id` ↔ `function_call_output` 연결을 바꾸지 마세요.
- 참가자 도구는 `src/tools/`에 추가하고 `runAgent.ts`에서 명시적으로 등록하세요.
- 모든 도구 호출은 실행 로그에 남기고, 인자와 결과에서 API 키·개인정보를 기록하지 마세요.
- 새로운 DB 접근은 `src/tools/`의 서버 전용 함수에서만 수행하세요.
- OpenAI와 Supabase 비밀값은 서버 환경변수로만 읽고 `NEXT_PUBLIC_` 접두어를 붙이지 마세요. Supabase URL과 publishable key만 공개 가능한 값입니다.
- DB 테이블을 바꿀 때 `supabase/schema.sql`과 `supabase/seed.sql`을 함께 갱신하세요.
- 사용자가 요청하지 않은 외부 API 쓰기, 배포, 스키마 적용을 실행하지 마세요.
- 에이전트 도구는 읽기 위주로 두고 쓰기 도구는 `save_shortlist` 1개만 둡니다.
- 크리에이터에게 연락하는 도구(DM, 이메일, 댓글), 개인 연락처 수집, 결제·계약 도구는 추가하지 마세요.

## 파일 위치

- `src/agent/`: 최대 단계 수를 포함한 에이전트 실행 루프
- `src/tools/`: `search_creators`, `get_creator_stats`, `save_shortlist` (+ `webSearch`, `youtube` 헬퍼)
- `src/config/`: 모델 및 도구 설명
- `src/app/api/agent/route.ts`: 요청 검증과 HTTP 응답
- `supabase/`: 데이터베이스 구조와 데모 시드
- `scripts/check-env.mjs`: 필요한 환경변수의 존재 확인

기본 흐름은 `search_creators`(플랫폼별) → `get_creator_stats`(5~10명) → `save_shortlist`입니다. 확인하지 않은 후보 저장, 중복, 1만 미만, 두 번째 저장은 서버에서 막습니다. 최대 실행 횟수는 16회이며, 웹 검색 비용이 들기 때문에 루프를 늘리기 전에 비용과 종료 조건을 확인하세요.
