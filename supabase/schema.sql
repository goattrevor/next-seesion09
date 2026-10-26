-- Session 09 · 크리에이터 추천 에이전트 스키마
-- Supabase SQL Editor에서 실행하세요. 기존 테이블(ideas, market_signals, agent_reports)은 건드리지 않습니다.
begin;

create table if not exists public.creator_shortlists (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  product text not null,
  target_customer text not null,
  summary text not null,
  creators jsonb not null default '[]'::jsonb,   -- 순위 1~5 크리에이터 (지표는 서버가 확인한 값만)
  sources jsonb not null default '[]'::jsonb,    -- 웹 검색에서 실제로 인용된 출처
  created_at timestamptz not null default now()
);

alter table public.creator_shortlists enable row level security;

-- 익명 키는 새 리스트 insert만 가능합니다. 조회·수정·삭제 권한은 주지 않습니다.
revoke all on public.creator_shortlists from public, anon, authenticated;
grant usage on schema public to anon;
grant insert (id, prompt, product, target_customer, summary, creators, sources)
  on public.creator_shortlists to anon;

drop policy if exists "Workshop can save shortlists" on public.creator_shortlists;
create policy "Workshop can save shortlists" on public.creator_shortlists for insert to anon with check (true);

commit;
