# Session 09 · 아이디어 검증 에이전트

이 레포는 LLM이 도구를 선택하고, 우리 코드가 도구를 실행한 뒤, 결과를 다시 LLM에 전달하는 흐름을 보여주는 실습 템플릿입니다.

## 에이전트 목표

> 사용자가 한 문장 아이디어를 입력하면, 웹 검색으로 ① 국내외 유사 서비스(종료·실패 사례 포함) 최대 6개, ② 한국 시장 진입 시 직접·간접 경쟁사 최대 8개, ③ 시장 규모·성장률(기준 연도·출처 포함)과 핵심 타깃 고객을 조사한다. 조사에서 실제로 인용된 출처만 붙인 리포트 1건을 저장하면 종료하며, 확인하지 못한 수치는 지어내지 않고 "확인 불가"로 남긴다.

목표를 바꿀 때는 `src/config/demo.ts`의 `AGENT_INSTRUCTIONS`, `src/tools/definitions.ts`의 개수 제한, `runAgent.ts`의 검증 로직을 함께 맞추세요.

## 수정 규칙

- `src/agent/runAgent.ts`의 도구 호출 루프와 `call_id` ↔ `function_call_output` 연결을 바꾸지 마세요.
- 참가자 도구는 `src/tools/`에 추가하고 `runAgent.ts`에서 명시적으로 등록하세요.
- 모든 도구 호출은 실행 로그에 남기고, 인자와 결과에서 API 키·개인정보를 기록하지 마세요.
- 새로운 DB 접근은 `src/tools/`의 서버 전용 함수에서만 수행하세요.
- OpenAI와 Supabase 비밀값은 서버 환경변수로만 읽고 `NEXT_PUBLIC_` 접두어를 붙이지 마세요. Supabase URL과 publishable key만 공개 가능한 값입니다.
- DB 테이블을 바꿀 때 `supabase/schema.sql`과 `supabase/seed.sql`을 함께 갱신하세요.
- 사용자가 요청하지 않은 외부 API 쓰기, 배포, 스키마 적용을 실행하지 마세요.

## 파일 위치

- `src/agent/`: 최대 단계 수를 포함한 에이전트 실행 루프
- `src/tools/`: `webResearch`(search_similar_cases · search_competitors · research_market), `save_report`
- `src/config/`: 모델 및 도구 설명
- `src/app/api/agent/route.ts`: 요청 검증과 HTTP 응답
- `supabase/`: 데이터베이스 구조와 데모 시드
- `scripts/check-env.mjs`: 필요한 환경변수의 존재 확인

기본 순서는 `search_similar_cases` → `search_competitors` → `research_market` → `save_report`입니다. 순서는 서버에서도 강제합니다. 최대 실행 횟수는 6회이며, 웹 검색 비용이 들기 때문에 루프를 늘리기 전에 비용과 종료 조건을 확인하세요.
