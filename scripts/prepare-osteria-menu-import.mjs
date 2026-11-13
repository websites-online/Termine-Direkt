import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const data = JSON.parse(readFileSync(new URL('../public/menus/osteria-da-michele.json', import.meta.url), 'utf8'));
if (data.companySlug !== 'osteria-da-michele' || data.menu.length !== 138) {
  throw new Error('Unexpected company or incomplete menu.');
}
const payload = Object.fromEntries(['menu', 'menuNotes', 'menuDocumentUrl', 'offeringsTitle', 'offeringsIntro'].map(key => [key, data[key]]));
const json = JSON.stringify(payload, null, 2);
if (json.includes('$menu$')) throw new Error('Unexpected SQL delimiter in menu.');
const sql = `-- Prepared import from OSTERIAMICHELE-Speisekarte-korrigiert.pdf.
-- Deploy the matching API/frontend first: older versions truncate menus to 60 entries.
-- Only this company's menu fields change. Existing photos and profile texts remain.
begin;
do $import$
declare
  target record;
  menu_data jsonb := $menu$${json}$menu$::jsonb;
begin
  select id, public_profile into strict target
  from public.companies
  where id = 'b8a5f4c6-dee5-4fcb-ac52-8429b8eb1575'
    and slug = 'osteria-da-michele'
    and lower(trim(name)) = 'osteria da michele'
    and service_type = 'restaurant'
  for update;

  if coalesce(target.public_profile->'menu', '[]'::jsonb) <> '[]'::jsonb
    and target.public_profile->'menu' <> menu_data->'menu' then
    raise exception 'The company already has a different menu. Review it before replacing it.';
  end if;

  update public.companies
  set public_profile = coalesce(public_profile, '{}'::jsonb) || menu_data
  where id = target.id;
end;
$import$;
commit;

select slug, jsonb_array_length(public_profile->'menu') as menu_items
from public.companies
where id = 'b8a5f4c6-dee5-4fcb-ac52-8429b8eb1575';
`;
const directory = new URL('../docs/data-imports/', import.meta.url);
mkdirSync(directory, { recursive: true });
writeFileSync(new URL('osteria-da-michele-menu.sql', directory), sql);
console.log('Prepared SQL for Osteria da Michele: 138 items. No database connection or writes.');
