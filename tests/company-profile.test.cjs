const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function setup({ missingColumn = false } = {}) {
  const state = { writes: [], reads: 0, row: { id: '1', name: 'Atelier7', slug: 'atelier7', address: 'Straße 1', hours: 'Di–Fr 10:00–19:00', email: 'unchanged@example.test', service_type: 'friseur', booking_mode: 'request', created_at: '2026-11-05' } };
  const env = { SUPABASE_URL: 'https://example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-key', ADMIN_SESSION_SECRET: 'profile-test-secret' };
  const cache = new Map();
  const client = { from() {
    let update;
    const builder = {
      select() { return builder; }, eq() { return builder; }, neq() { return builder; },
      async order() { return { data: [state.row], error: null }; },
      update(value) { update = value; return builder; },
      insert(value) { update = value; return builder; },
      async maybeSingle() { state.reads++; return { data: null, error: null }; },
      async single() {
        if (update && missingColumn) return { data: null, error: { message: "Could not find the 'public_profile' column of 'companies' in the schema cache", code: 'PGRST204' } };
        if (update) { state.writes.push(update); state.row = { ...state.row, ...update }; }
        return { data: state.row, error: null };
      },
    };
    return builder;
  } };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const module = { exports: {} };
    const localRequire = createRequire(filename);
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, process: { env }, Buffer, console,
      require(id) {
        if (id === '@supabase/supabase-js') return { createClient: () => client };
        if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id + '.ts'));
        return localRequire(id);
      },
    }, { filename });
    cache.set(filename, module.exports);
    return module.exports;
  }
  const profile = load(path.join(root, 'src/app/shared/company-profile.ts'));
  const auth = load(path.join(root, 'api/_lib/admin-auth.ts'));
  const handler = load(path.join(root, 'api/companies.ts'));
  async function request(method, body, authorized = true, query = { slug: 'atelier7' }) {
    const res = { status(code) { this.statusCode = code; return this; }, json(value) { this.body = JSON.parse(JSON.stringify(value)); return this; } };
    await handler({ method, query, body,
      headers: authorized ? { authorization: 'Bearer ' + auth.createAdminToken('webdesignodobasic@gmail.com') } : {} }, res);
    return res;
  }
  return { state, profile, request };
}

test('profile normalizer bounds uploads and rejects executable image sources', () => {
  const { profile } = setup();
  const normalized = profile.normalizeCompanyProfile({ aboutText: 'x'.repeat(3000), photos: [
    { src: 'javascript:alert(1)' }, { src: 'data:image/svg+xml;base64,AAAA' },
    { src: 'https://example.test/photo.jpg', title: 'A photo' },
    { src: 'data:image/webp;base64,' + 'A'.repeat(180000) },
  ], menu: [{ name: 'Pasta', category: 'Primi', price: 12.345 }, { name: '', price: 2 }] });
  assert.equal(normalized.aboutText.length, 2400);
  assert.equal(normalized.photos.length, 1);
  assert.equal(normalized.menu.length, 1);
  assert.equal(normalized.menu[0].price, 12.35);
});

test('real company defaults contain no invented photos, menu or introduction', () => {
  const { profile } = setup();
  for (const type of ['restaurant', 'friseur']) {
    const defaults = profile.defaultCompanyProfile(type);
    assert.equal(defaults.photos.length, 0);
    assert.equal(defaults.menu.length, 0);
    assert.equal(defaults.aboutText, '');
  }
});

test('the complete Osteria menu survives an authenticated API round trip with sizes and notes', async () => {
  const { request, state } = setup();
  const imported = JSON.parse(fs.readFileSync(path.join(root, 'public/menus/osteria-da-michele.json'), 'utf8'));
  assert.equal(imported.menu.length, 138);
  assert.equal(new Set(imported.menu.map(item => item.id)).size, 138);
  assert.equal(imported.menu.filter(item => item.category === 'Pizza').length, 25);
  assert.equal(imported.menu.find(item => item.id === 'michele-165').price, 19.9);
  assert.equal(imported.menu.find(item => item.id === 'michele-230').priceLabel, '0,3 l · 3,30 €\n0,5 l · 4,30 €');
  assert.equal(imported.menu.find(item => item.id === 'michele-298').priceLabel, '0,25 l · 4,80 €\n0,4 l · 6,60 €');
  const profile = {
    ...imported, aboutText: 'Existing company introduction.',
    photos: [{ src: 'https://example.test/existing.jpg', title: 'Existing photo', alt: '' }],
  };
  const result = await request('PATCH', {
    name: state.row.name, address: state.row.address, hours: state.row.hours,
    email: state.row.email, serviceType: 'restaurant', profile,
  });
  assert.equal(result.statusCode, 200);
  const saved = (await request('GET')).body.profile;
  assert.deepEqual(saved.menu, imported.menu);
  assert.equal(saved.menuNotes, imported.menuNotes);
  assert.equal(saved.menuDocumentUrl, '/media/menus/osteria-da-michele.pdf');
  assert.equal(saved.photos[0].title, 'Existing photo');
  assert.equal(saved.aboutText, 'Existing company introduction.');
});

test('large menus stay bounded and menu documents reject executable or unrelated sources', () => {
  const { profile } = setup();
  const normalized = profile.normalizeCompanyProfile({
    menu: Array.from({ length: 350 }, (_, index) => ({ name: 'Dish '+index, priceLabel: 'x'.repeat(200) })),
    menuNotes: 'x'.repeat(2000), menuDocumentUrl: 'javascript:alert(1)',
  });
  assert.equal(normalized.menu.length, 300);
  assert.equal(normalized.menu[0].priceLabel.length, 120);
  assert.equal(normalized.menuNotes.length, 1600);
  assert.equal(normalized.menuDocumentUrl, undefined);
  for (const url of ['/media/menus/../secret.pdf', '/media/menus/logo.svg', 'https://example.test/file.html']) {
    assert.equal(profile.normalizeCompanyProfile({ menuDocumentUrl: url }).menuDocumentUrl, undefined);
  }
});

test('profile writes require an authenticated admin before accessing the database', async () => {
  const { request, state } = setup();
  const result = await request('PATCH', { profile: {} }, false);
  assert.equal(result.statusCode, 401);
  assert.equal(state.reads, 0);
  assert.equal(state.writes.length, 0);
});

test('saved profile survives the public API round trip; legacy edits preserve it', async () => {
  const { request, state } = setup();
  const base = { name: 'Atelier7', address: 'Straße 1', hours: 'Di–Fr 10:00–19:00', email: 'unchanged@example.test', serviceType: 'friseur', bookingMode: 'request' };
  let response = await request('PATCH', { ...base, profile: { aboutTitle: 'Hi, ich bin Arsel.', aboutText: 'Neue Vorstellung.\nZweiter Absatz.', photos: [], menu: [] } });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.profile.aboutTitle, 'Hi, ich bin Arsel.');
  assert.equal(state.row.email, base.email);
  assert.equal(state.row.booking_mode, 'request');
  response = await request('GET');
  assert.equal(response.body.profile.aboutText, 'Neue Vorstellung.\nZweiter Absatz.');
  const overview = await request('GET', undefined, true, {});
  assert.equal(overview.body[0].profile, undefined, 'Company overview omits large galleries');
  response = await request('PATCH', base);
  assert.equal(response.body.profile.aboutTitle, 'Hi, ich bin Arsel.');
  assert.equal(Object.hasOwn(state.writes.at(-1), 'public_profile'), false);
});

test('a missing profile migration reports failure without silently saving other fields', async () => {
  const { request, state } = setup({ missingColumn: true });
  const response = await request('PATCH', { name: 'Atelier7', address: 'Straße 1', hours: 'Di–Fr 10:00–19:00', email: 'unchanged@example.test', profile: {} });
  assert.equal(response.statusCode, 503);
  assert.equal(state.writes.length, 0);
});

test('downgrading and upgrading a company keeps its stored PRO profile contents', async () => {
  const { request, state } = setup();
  state.row.plan_tier = 'pro';
  state.row.public_profile = { aboutTitle: 'Vorstellung', aboutText: 'Bleibt gespeichert.', photos: [{ src: 'https://example.test/salon.jpg', title: 'Salon', alt: 'Salon' }], menu: [{ id: 'dish', name: 'Pasta', category: 'Speisen', description: 'Hausgemacht', price: 15 }], serviceDescriptions: { cut: 'Mit Beratung.' } };
  const original = JSON.stringify(state.row.public_profile);
  const base = { name: state.row.name, address: state.row.address, hours: state.row.hours, email: state.row.email, serviceType: 'friseur' };
  let response = await request('PATCH', { ...base, planTier: 'starter' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.planTier, 'starter');
  assert.equal(JSON.stringify(state.row.public_profile), original);
  response = await request('PATCH', { ...base, planTier: 'pro' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.planTier, 'pro');
  assert.equal(response.body.profile.photos.length, 1);
  assert.equal(response.body.profile.menu[0].name, 'Pasta');
  assert.equal(JSON.stringify(state.row.public_profile), original);
});
