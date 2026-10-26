-- Session 09 · 아이디어 검증 에이전트 스키마
-- Supabase SQL Editor에서 실행하세요. 기존 테이블은 지우지 않고 필요한 컬럼만 추가합니다.
-- (이전 실습의 ideas, market_signals 테이블은 더 이상 쓰지 않지만 남겨 두어도 됩니다.)
begin;

create table if not exists public.agent_reports (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  title text not null,
  summary text not null,
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 검증 리포트 구조화 컬럼
alter table public.agent_reports add column if not exists similar_cases jsonb not null default '[]'::jsonb;
alter table public.agent_reports add column if not exists competitors jsonb not null default '[]'::jsonb;
alter table public.agent_reports add column if not exists market jsonb not null default '{}'::jsonb;
alter table public.agent_reports add column if not exists sources jsonb not null default '[]'::jsonb;

alter table public.agent_reports enable row level security;

revoke all on public.agent_reports from public, anon, authenticated;
grant usage on schema public to anon;
grant insert (prompt, title, summary, findings, similar_cases, competitors, market, sources)
  on public.agent_reports to anon;

drop policy if exists "Workshop can save reports" on public.agent_reports;
create policy "Workshop can save reports" on public.agent_reports for insert to anon with check (true);

commit;
