const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

const configPath = ts.findConfigFile(path.resolve(__dirname, '../api'), ts.sys.fileExists);
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
const receivedAt = '2026-11-03T11:00:00.000Z';
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-11-03T12:00:00.000Z'])); }
  static now() { return new TestDate().getTime(); }
}

function setup(overrides = {}) {
  const company = {
    slug: 'atelier7', name: 'Atelier7', service_type: 'friseur',
    booking_mode: 'confirm', plan_tier: 'pro', login_pin: '123456',
    email: 'salon@example.test', booking_buffer_minutes: 0, slot_capacity: 1,
    ...overrides,
  };
  const state = {
    companies: [company], reservations: [], booking_requests: [],
    booking_events: [
      { company_slug: company.slug, event_type: 'page_view', session_id: 'visitor', created_at: receivedAt },
      { company_slug: company.slug, event_type: 'booking_started', session_id: 'visitor', created_at: receivedAt },
    ],
  };
  const client = { from(table) {
    const filters = {};
    let range;
    let inserted;
    const result = () => {
      const rows = state[table].filter(row => Object.entries(filters).every(([key, value]) => row[key] === value));
      return { data: range ? rows.slice(range[0], range[1] + 1) : rows, count: rows.length, error: null };
    };
    const builder = {
      select() { return builder; },
      eq(key, value) { filters[key] = value; return builder; },
      or() { return builder; },
      order() { return builder; },
      range(from, to) { range = [from, to]; return builder; },
      insert(value) {
        inserted = { id: `${table}-${state[table].length + 1}`, created_at: receivedAt,
          ...(table === 'booking_requests' ? { status: 'pending' } : {}), ...value };
        state[table].push(inserted);
        return builder;
      },
      async single() { return { data: inserted || result().data[0], error: null }; },
      async maybeSingle() { return { data: result().data[0] || null, error: null }; },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    };
    return builder;
  } };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const localRequire = createRequire(filename);
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: options, fileName: filename,
    }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports,
      require(id) {
        if (id === '@supabase/supabase-js') return { createClient: () => client };
        if (id === 'resend') return { Resend: class { emails = { send: async () => ({ data: { id: 'email' } }) }; } };
        if (id.endsWith('/web-push')) return { sendCompanyPush: async () => {} };
        if (id.startsWith('.')) {
          const target = path.resolve(path.dirname(filename), `${id}.ts`);
          if (fs.existsSync(target)) return load(target);
        }
        return localRequire(id);
      },
      process: { env: {
        SUPABASE_URL: 'https://database.example.test', SUPABASE_SERVICE_ROLE_KEY: 'test-key',
        RESEND_API_KEY: 'test-key', FROM_EMAIL: 'booking@example.test', BOOKING_ACTION_SECRET: 'test-secret',
      } },
      Buffer, URL, Date: TestDate, Intl, console: { log() {}, error() {} },
    }, { filename });
    cache.set(filename, module.exports);
    return module.exports;
  }
  async function call(endpoint, method = 'GET', body = {}, query = {}) {
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
    };
    await load(path.resolve(__dirname, '../api', endpoint))({
      method, body, query,
      headers: { authorization: `Bearer ${Buffer.from(`${company.slug}:123456`).toString('base64')}` },
    }, response);
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    return response.body;
  }
  return { company, state, call };
}

const activity = (slug, extra = {}) => ({
  restaurant_slug: slug, date: '2026-11-03', time: '14:00',
  guest_name: 'Testkunde', guest_email: 'kunde@example.test', created_at: receivedAt, ...extra,
});

test('Atelier7 salon and home submissions increase both company and admin request statistics', async () => {
  const { company, state, call } = setup();
  assert.equal((await call('company/stats.ts')).total, 0);
  for (const [index, bookingLocation] of ['salon', 'home'].entries()) {
    const submission = await call('reservations.ts', 'POST', {
      restaurantName: company.name, restaurantSlug: company.slug, restaurantEmail: company.email,
      serviceType: 'friseur', service: 'Herrenhaarschnitt', serviceValue: 'herrenhaarschnitt',
      guestName: 'Testkunde', guestEmail: 'kunde@example.test', phone: '0911000000', people: 1,
      date: '2026-11-03', time: '14:00', bookingLocation,
      ...(bookingLocation === 'home' ? { homeVisitAddress: { street: 'Teststraße', houseNumber: '7', postalCode: '90429', city: 'Nürnberg' } } : {}),
    });
    assert.equal(submission.requestMode, true);
    assert.equal(state.reservations.length, 0);
    const owner = await call('company/stats.ts');
    assert.equal(owner.eventKind, 'request');
    assert.equal(owner.total, index + 1);
    assert.equal(owner.conversion.submissions, index + 1);
    const admin = await call('admin-stats.ts', 'GET', {}, { period: 'all' });
    assert.equal(admin.rows[0].requests, index + 1);
    assert.equal(admin.rows[0].total, index + 1);
  }
});

for (const [label, overrides, requestMode] of [
  ['another direct-booking salon', { slug: 'other-salon' }, false],
  ['another request salon', { slug: 'other-salon', booking_mode: 'request' }, true],
  ['a restaurant with the same slug', { service_type: 'restaurant' }, false],
]) {
  test(`preserves statistics for ${label}`, async () => {
    const { company, state, call } = setup(overrides);
    state.reservations.push(activity(company.slug), activity(company.slug, { note: '__BLOCK__:block-1' }));
    state.booking_requests.push(activity(company.slug, { status: 'pending' }), activity(company.slug, { status: 'pending' }));
    const result = await call('company/stats.ts');
    assert.equal(result.eventKind, requestMode ? 'request' : 'booking');
    assert.equal(result.total, requestMode ? 2 : 1);
  });
}

test('admin counts pending requests and approved bookings once, by reception date', async () => {
  const { company, state, call } = setup();
  state.booking_requests.push(
    activity(company.slug, { id: 'pending', status: 'pending', date: '2027-02-01' }),
    activity(company.slug, { id: 'approved', status: 'approved' }),
    activity(company.slug, { id: 'rejected', status: 'rejected' }),
  );
  state.reservations.push(
    activity(company.slug, { booking_request_id: 'approved', created_at: '2027-02-01T11:00:00.000Z' }),
    activity(company.slug, { note: '__BLOCK__:block-1' }),
  );
  const result = await call('admin-stats.ts', 'GET', {}, { period: 'month', month: '2026-11' });
  assert.equal(result.rows[0].requests, 1);
  assert.equal(result.rows[0].bookings, 1);
  assert.equal(result.rows[0].total, 2);
});

test('Atelier7 conversion counts submitted requests and approved completions', async () => {
  const { company, state, call } = setup();
  for (const status of ['pending', 'approved', 'rejected']) {
    state.booking_requests.push(activity(company.slug, { status }));
  }
  const result = await call('company/stats.ts');
  assert.equal(result.total, 2);
  assert.equal(result.conversion.submissions, 3);
  assert.equal(result.conversion.completions, 1);
});

test('admin returns per-company and overall previous-month comparisons plus a monthly trend', async () => {
  const { company, state, call } = setup();
  state.reservations.push(activity(company.slug), activity(company.slug, { created_at: '2026-10-01T10:00:00Z' }));
  state.booking_requests.push(activity(company.slug, { status: 'pending' }));
  const result = await call('admin-stats.ts', 'GET', {}, { period: 'this-month' });
  assert.equal(result.interactionsTotal, 2);
  assert.equal(result.requestsTotal, 1);
  assert.equal(result.comparison.interactionsTotal, 1);
  assert.equal(result.comparison.to, '2026-10-03');
  assert.equal(result.rows[0].previousTotal, 1);
  assert.equal(result.rows[0].changePercent, 100);
  assert.equal(result.monthlyTrend.length, 6);
});

test('admin comparisons include paginated rows beyond the first 1000 records', async () => {
  const { company, state, call } = setup();
  for (let index = 0; index < 1002; index++) state.reservations.push(activity(company.slug));
  state.reservations.push(activity(company.slug, { created_at: '2026-10-01T10:00:00Z' }));
  const result = await call('admin-stats.ts', 'GET', {}, { period: 'this-month' });
  assert.equal(result.bookingsTotal, 1002);
  assert.equal(result.comparison.bookingsTotal, 1);
  assert.equal(result.rows[0].change, 1001);
});
