alter table public.companies
  add column if not exists plan_tier text not null default 'starter';

alter table public.companies
  drop constraint if exists companies_plan_tier_check;

alter table public.companies
  add constraint companies_plan_tier_check
  check (plan_tier in ('starter', 'pro'));
