# Session 09 · 광고 모델 추천 에이전트

## 에이전트 목표

> 사용자가 제품 설명과 타깃 고객을 입력하면, 웹 검색과 공개 데이터로 인스타그램·유튜브·틱톡에서 팔로워 1만 명 이상(마이크로 이상)인 국내 크리에이터 후보를 찾아 지표를 확인하고, 제품과의 적합 근거를 기준으로 상위 5명을 1~5위로 순위를 매긴 추천 리스트 1건을 저장하면 종료한다. 확인하지 못한 지표는 지어내지 않고 "확인 불가"로 남긴다.

```text
입력: 제품: 피부 자극이 적은 비건 선크림 / 타깃 고객: 피부 고민이 많은 20대 대학생·사회초년생
search_creators(instagram) → search_creators(youtube) → search_creators(tiktok)
→ get_creator_stats × 5~10 → save_shortlist → 최종 요약
```

## 빠른 시작

필요 환경: Node.js 20.9 이상, OpenAI API 키, Supabase 프로젝트. YouTube Data API 키는 선택입니다.

1. `.env.example`을 `.env.local`로 복사하고 OpenAI 키·모델, Supabase URL·publishable key를 입력합니다. 유튜브 지표를 정확하게 받으려면 `YOUTUBE_API_KEY`도 넣습니다.
2. Supabase SQL Editor에서 `supabase/schema.sql`을 실행합니다. 시드는 필요 없습니다.
3. `npm install` 후 `npm run check:env`, `npm run dev`를 실행합니다.
4. 제품과 타깃 고객을 입력해 실행하고(2~5분), 우측 로그와 하단 순위, Supabase의 `creator_shortlists` 테이블을 확인합니다.

환경 점검 스크립트는 값이 설정됐는지만 검사하고 비밀값은 출력하지 않습니다. Supabase publishable key는 브라우저에 노출 가능한 키이며, 리스트 테이블은 RLS로 insert만 허용합니다(조회·수정·삭제 불가). 서비스 롤 키는 사용하지 않습니다.

## 도구 설계

| 이름 | 입력 | 출력 | 언제 쓰는가 |
|---|---|---|---|
| `search_creators` | platform, product, keywords[] | 후보 목록(또는 검색 요약)과 출처 | 한 플랫폼에서 후보를 새로 찾아야 할 때. 플랫폼마다 호출하고, 부족하면 키워드를 바꿔 재호출 (읽기) |
| `get_creator_stats` | platform, handle | 이름, URL, 팔로워, 평균 조회수, 최근 콘텐츠, 확인 불가 항목 | 후보를 순위에 넣기 전 지표·주제를 확인할 때. 최대 10명 (읽기) |
| `save_shortlist` | product, target_customer, summary, creators[5]: rank, platform, handle, 적합 근거, 주의점 | 저장된 리스트 id | 5명 순위가 확정됐을 때 1회만 (쓰기) |

순위 기준은 ① 콘텐츠 주제와 제품의 일치 → ② 시청자층과 타깃의 일치 → ③ 확인된 지표 순서입니다. 플랫폼별 인원은 정하지 않습니다.

## 서버가 강제하는 규칙

- `get_creator_stats`로 확인하지 않은 후보는 순위에 넣을 수 없습니다.
- 정확히 5명, rank 1~5가 한 번씩, 같은 사람 중복 금지, 팔로워 1만 미만으로 확인된 후보 금지.
- 팔로워·조회수·이름·URL은 모델이 쓴 값이 아니라 도구가 확인한 값만 저장합니다. 출처도 웹 검색에 실제로 인용된 URL만 붙입니다.
- 저장은 1회만 허용합니다.
- 모델이 고칠 수 있는 위반은 실행을 멈추지 않고 "거절" 결과로 돌려줘 다시 시도하게 합니다.

## 데이터 출처와 한계

- **유튜브**: `YOUTUBE_API_KEY`가 있으면 YouTube Data API(읽기)로 채널 검색, 구독자 수, 최근 영상 10개 평균 조회수를 조회합니다. 없으면 웹 검색으로 대신합니다.
- **인스타그램·틱톡**: 일반 개발자용 공개 검색 API가 없어 웹 검색(OpenAI `web_search`, 한국 위치)으로 찾습니다. 팔로워·조회수는 "확인 불가"가 자주 나옵니다. 지표만으로 비교하면 유튜브가 늘 유리해지므로, 지표는 적합도가 비슷할 때만 비교하도록 지시했습니다.
- 웹 검색 결과는 오래됐거나 틀릴 수 있습니다. 섭외 전에 반드시 프로필을 직접 확인하세요.

## 하지 않는 일

크리에이터에게 연락(DM·이메일·댓글)하지 않고, 개인 연락처·실명·거주지를 수집하지 않으며, 유료 DB 구독·결제·계약을 하지 않습니다.

## 비용

한 번 실행에 웹 검색 하위 호출 최대 13회(후보 검색 3회 이상 + 지표 확인 최대 10회)와 에이전트 루프 최대 16회가 발생합니다. 그래서 IP당 분당 2회로 제한합니다.

## 레포 구조

```text
src/
  agent/runAgent.ts           # Responses API 도구 호출 루프, 규칙 검증
  tools/definitions.ts        # 에이전트에 노출하는 함수 도구 스키마
  tools/searchCreators.ts     # 후보 찾기 (YouTube API 또는 웹 검색)
  tools/getCreatorStats.ts    # 지표 확인 (YouTube API 또는 웹 검색)
  tools/saveShortlist.ts      # 추천 리스트 저장 (유일한 쓰기)
  tools/webSearch.ts          # web_search 하위 호출, 숫자 파싱
  tools/youtube.ts            # YouTube Data API 읽기 클라이언트
  config/demo.ts              # 모델, 목표, 에이전트 지침, 검색 프롬프트
  lib/                        # 상수(후보 수·최소 팔로워·플랫폼), 타입, Supabase 클라이언트
  app/api/agent/route.ts      # 입력 검증, 요청 제한, API 오류 처리
  components/AgentDemo.tsx    # 입력, 실행 로그, 순위 결과
scripts/check-env.mjs         # 환경변수 사전 점검
supabase/schema.sql           # RLS가 적용된 creator_shortlists 테이블
```

## 실습 확장

새 도구는 `src/tools/`에 서버 함수와 JSON Schema를 추가하고 `src/agent/runAgent.ts`의 `executeTool`에 등록합니다. 기존 루프의 대화 기록과 `call_id` 연결은 그대로 유지합니다. 후보 수·최소 팔로워·플랫폼은 `src/lib/shared.ts`, 실행 횟수는 같은 파일의 `MAX_STEPS`에서 조절합니다.
