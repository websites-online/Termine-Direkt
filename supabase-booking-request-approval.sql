alter table public.booking_requests
  add column if not exists status text not null default 'pending',
  add column if not exists approved_at timestamptz,
  add column if not exists proposed_date date,
  add column if not exists proposed_time text,
  add column if not exists alternative_sent_at timestamptz,
  add column if not exists alternative_expires_at timestamptz,
  add column if not exists confirmation_email_sent_at timestamptz;

alter table public.reservations
  add column if not exists booking_request_id uuid;

create unique index if not exists reservations_booking_request_id_unique
  on public.reservations (booking_request_id)
  where booking_request_id is not null;

create index if not exists booking_requests_active_alternatives_idx
  on public.booking_requests (restaurant_slug, proposed_date, proposed_time, alternative_expires_at)
  where status = 'alternative_sent';
