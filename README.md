# Session 09 · 아이디어 검증 에이전트

아이디어를 입력하면 에이전트가 웹을 검색해 유사 사례, 진입 시 경쟁사, 시장 규모·타깃을 조사하고 출처가 달린 검증 리포트를 Supabase에 저장합니다.

```text
입력: 대학생이 강의 녹음을 올리면 AI가 시험 대비 요약 노트를 만들어주는 서비스
search_similar_cases → search_competitors → research_market → save_report → 최종 요약
```

## 빠른 시작

필요 환경: Node.js 20.9 이상, OpenAI API 키, Supabase 프로젝트.

1. `.env.example`을 `.env.local`로 복사하고 OpenAI 키·모델, Supabase URL·publishable key를 입력합니다.
2. Supabase SQL Editor에서 `supabase/schema.sql`을 실행합니다. 기존 실습 DB에 실행해도 필요한 컬럼만 추가합니다. 시드는 필요 없습니다.
3. `npm install` 후 `npm run check:env`, `npm run dev`를 실행합니다.
4. 아이디어를 입력해 실행하고(1~3분), 우측 로그와 하단 리포트, Supabase의 `agent_reports` 테이블을 확인합니다.

환경 점검 스크립트는 값이 설정됐는지만 검사하고 비밀값은 출력하지 않습니다. Supabase publishable key는 브라우저에 노출 가능한 키이며, 리포트 테이블은 RLS 삽입 정책으로 제한합니다. 서비스 롤 키는 사용하지 않습니다.

## 레포 구조

```text
src/
  agent/runAgent.ts       # Responses API 도구 호출 루프와 max_steps
  tools/webResearch.ts    # OpenAI web_search로 유사 사례·경쟁사·시장 조사
  tools/saveReport.ts     # 구조화된 검증 리포트 저장
  tools/definitions.ts    # 에이전트에 노출하는 함수 도구 스키마
  config/demo.ts          # 모델, 에이전트 지침, 조사 주제별 프롬프트
  lib/                    # Supabase 클라이언트와 공유 타입
  app/api/agent/route.ts  # 입력 검증과 API 오류 처리
  components/AgentDemo.tsx # 목표 입력, 단계별 실행 로그, 결과
scripts/check-env.mjs     # 환경변수 사전 점검
supabase/schema.sql       # RLS가 적용된 리포트 테이블 (+구조화 컬럼)
supabase/seed.sql         # (사용 안 함)
AGENTS.md                 # 에이전트 도구 공통 실습 규칙
```

## 동작 방식

에이전트 루프에는 함수 도구만 등록합니다. 세 조사 도구는 같은 서버 함수 `webResearch`를 주제별 프롬프트로 실행하며, 그 안에서 별도 Responses API 호출에 내장 `web_search` 도구(한국 위치 기준)를 붙여 실제 웹을 검색합니다. 그래서 기존 루프의 `call_id` ↔ `function_call_output` 연결은 바꾸지 않았습니다.

리포트 출처는 모델이 적은 URL이 아니라 웹 조사 결과에 실제로 인용된 URL만 서버가 붙입니다. 그래도 모델 요약에는 오류가 있을 수 있으니 수치는 출처를 열어 확인하세요.

한 번 실행에 OpenAI 호출이 약 8회(조사 3회 + 루프 5회) 발생하고 웹 검색 비용이 추가됩니다. 그래서 IP당 분당 3회로 제한합니다. 실습 용도라 익명 리포트 저장을 허용하므로 공개 서비스로 배포하기 전에는 로그인, 사용자별 권한, 쓰기 제한을 추가해야 합니다.

## 실습 확장

새 기능은 `src/tools/`에 서버 함수와 JSON Schema를 추가하고, `src/agent/runAgent.ts`의 실행 맵에 등록합니다. 기존 루프의 대화 기록과 `call_id` 연결은 그대로 유지합니다. 새 웹 조사 주제는 `config/demo.ts`의 `RESEARCH_PROMPTS`에 프롬프트를, `runAgent.ts`의 `RESEARCH_TOOLS`에 도구 이름을 추가하면 됩니다. 실행 횟수는 `src/lib/shared.ts`의 `MAX_STEPS`(현재 6)에서 조절합니다.
