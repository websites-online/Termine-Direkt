-- Prepared for a later rollout. This file does not change booking or mail settings.
-- Run separately before deploying the editable company-profile feature.
alter table public.companies
  add column if not exists public_profile jsonb;

comment on column public.companies.public_profile is
  'Public profile texts, gallery images, menu and service descriptions.';
