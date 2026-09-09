alter table public.companies
  add column if not exists salon_services jsonb,
  add column if not exists show_service_prices boolean not null default false;

comment on column public.companies.salon_services is
  'Ausgewählte Friseur-Leistungen mit optionalem Preis als JSON-Liste.';

comment on column public.companies.show_service_prices is
  'Steuert, ob hinterlegte Servicepreise auf der Buchungsseite sichtbar sind.';
