-- One-time preparation for the company-profile rollout.
-- Run in the existing PROD project's SQL Editor BEFORE merging/deploying the app.
-- Combines the two prepared profile/PRO migrations; do not run unrelated SQL files.
-- Existing company fields, bookings, login PINs and mail settings are preserved.
-- Re-running never upgrades customers created after the first successful run.

begin;
set local lock_timeout = '5s';

lock table public.companies in share row exclusive mode;

alter table public.companies
  add column if not exists public_profile jsonb;
alter table public.companies
  add column if not exists plan_tier text not null default 'starter';

comment on column public.companies.public_profile is
  'Public profile texts, gallery images, menu and service descriptions.';

create schema if not exists nextime_migrations;
revoke all on schema nextime_migrations from public;

create table if not exists nextime_migrations.applied_migrations (
  migration_key text primary key,
  applied_at timestamptz not null default now(),
  snapshot jsonb not null
);
alter table nextime_migrations.applied_migrations enable row level security;
revoke all on table nextime_migrations.applied_migrations from public;

with applied as (
  insert into nextime_migrations.applied_migrations (migration_key, snapshot)
  select
    '2026-11-06-existing-companies-pro',
    coalesce(jsonb_agg(jsonb_build_object('id', id::text, 'plan_tier', plan_tier)), '[]'::jsonb)
  from public.companies
  on conflict (migration_key) do nothing
  returning snapshot
), upgraded as (
  update public.companies as company
  set plan_tier = 'pro'
  where company.plan_tier is distinct from 'pro'
    and company.id::text in (
      select previous->>'id'
      from applied, jsonb_array_elements(applied.snapshot) as previous
    )
  returning company.id
)
select
  exists(select 1 from applied) as applied_now,
  coalesce((select jsonb_array_length(snapshot) from applied), 0) as existing_companies,
  (select count(*) from upgraded) as upgraded_companies;

commit;
