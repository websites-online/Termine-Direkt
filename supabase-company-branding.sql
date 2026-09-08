-- Einmalig im Supabase SQL Editor ausführen.
-- Bestehende Unternehmen bleiben unverändert und verwenden automatisch das NexTime-Standarddesign.
alter table public.companies
  add column if not exists logo_url text,
  add column if not exists brand_color text default '#4f46e5';
