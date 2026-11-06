-- Run once in PROD before rolling out PRO-only public profile sections.
-- Requires supabase-company-plan.sql. Only plan_tier is changed.
-- The first successful execution snapshots ALL existing companies, upgrades them,
-- and records the migration. Re-running it never upgrades later Starter customers
-- or overrides a later manual downgrade. New-company defaults remain 'starter'.

begin;

lock table public.companies in share row exclusive mode;

create schema if not exists nextime_migrations;
revoke all on schema nextime_migrations from public;

create table if not exists nextime_migrations.applied_migrations (
  migration_key text primary key,
  applied_at timestamptz not null default now(),
  snapshot jsonb not null
);
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
