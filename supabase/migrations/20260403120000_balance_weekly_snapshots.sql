-- Weekly balance snapshots for admin dashboard charts (run in Supabase SQL editor if migrations are not applied automatically)
create table if not exists public.balance_weekly_snapshots (
  id uuid primary key default gen_random_uuid(),
  week_start date not null,
  total_receivables_all numeric(18, 2) not null default 0,
  total_payables_all numeric(18, 2) not null default 0,
  receivables_operational numeric(18, 2) not null default 0,
  receivables_customer numeric(18, 2) not null default 0,
  receivables_merchant numeric(18, 2) not null default 0,
  payables_supplier numeric(18, 2) not null default 0,
  count_by_type jsonb not null default '{}'::jsonb,
  year_cohort_receivables jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint balance_weekly_snapshots_week_start_key unique (week_start)
);

create index if not exists balance_weekly_snapshots_week_start_idx
  on public.balance_weekly_snapshots (week_start desc);

comment on table public.balance_weekly_snapshots is 'Automated weekly totals for dashboard line charts; populated by cron or manual admin trigger.';
