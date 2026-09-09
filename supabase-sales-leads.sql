create table if not exists public.sales_leads (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  source_type text not null default 'openstreetmap',
  source_id text,
  name text not null,
  category text not null check (category in ('restaurant', 'friseur')),
  city text not null,
  postcode text,
  address text,
  website text,
  phone text,
  email text,
  contact_url text,
  source_url text,
  scan_region text not null,
  has_booking_system boolean not null default false,
  booking_system text,
  booking_evidence text,
  confidence smallint not null default 0 check (confidence between 0 and 100),
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'contacted', 'replied', 'no_interest', 'customer', 'excluded')),
  notes text,
  discovered_at timestamptz not null default now(),
  last_scanned_at timestamptz not null default now(),
  contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_leads_status_idx on public.sales_leads (status);
create index if not exists sales_leads_region_idx on public.sales_leads (scan_region);
create index if not exists sales_leads_discovered_idx on public.sales_leads (discovered_at desc);

alter table public.sales_leads enable row level security;
