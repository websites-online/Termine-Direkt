create table if not exists public.company_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_slug text not null references public.companies(slug) on update cascade on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists company_push_subscriptions_company_slug_idx
  on public.company_push_subscriptions(company_slug);

alter table public.company_push_subscriptions enable row level security;

create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  company_slug text not null references public.companies(slug) on update cascade on delete cascade,
  event_type text not null check (event_type in ('page_view', 'booking_started')),
  session_id text not null,
  created_at timestamptz not null default now(),
  unique (company_slug, event_type, session_id)
);

create index if not exists booking_events_company_created_idx
  on public.booking_events(company_slug, created_at desc);

alter table public.booking_events enable row level security;
