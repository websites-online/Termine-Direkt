alter table public.booking_requests
  add column if not exists status text not null default 'pending',
  add column if not exists approved_at timestamptz;

alter table public.reservations
  add column if not exists booking_request_id uuid;

create unique index if not exists reservations_booking_request_id_unique
  on public.reservations (booking_request_id)
  where booking_request_id is not null;
