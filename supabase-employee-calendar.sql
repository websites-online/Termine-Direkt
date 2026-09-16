alter table public.companies
  add column if not exists calendar_mode text not null default 'shared',
  add column if not exists employees jsonb not null default '[]'::jsonb;

alter table public.reservations
  add column if not exists employee_id text,
  add column if not exists duration_minutes integer not null default 45;

alter table public.booking_requests
  add column if not exists employee_id text,
  add column if not exists duration_minutes integer not null default 45;

create index if not exists reservations_employee_calendar_idx
  on public.reservations (restaurant_slug, date, employee_id, time);

create unique index if not exists reservations_employee_exact_slot_unique
  on public.reservations (restaurant_slug, date, employee_id, time)
  where employee_id is not null;

create index if not exists booking_requests_employee_calendar_idx
  on public.booking_requests (restaurant_slug, date, employee_id, time);
