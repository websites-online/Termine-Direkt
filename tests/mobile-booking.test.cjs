const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');

// Exercise the actual API handlers with isolated database and email adapters.
function setup(overrides = {}) {
  const company = {
    slug: 'atelier7', name: 'Atelier7', service_type: 'friseur',
    email: 'salon@example.test', login_pin: '123456', booking_mode: 'confirm',
    booking_buffer_minutes: 0, slot_capacity: 1, slot_interval_minutes: 30,
    ...overrides,
  };
  const state = { reservations: [], booking_requests: [], emails: [], pushes: [] };
  const client = { from(table) {
    const filters = {};
    let record;
    const result = () => {
      const rows = (state[table] || []).filter((row) =>
        Object.entries(filters).every(([key, value]) => row[key] === value));
      return { data: rows, count: rows.length, error: null };
    };
    const builder = {
      select() { return builder; },
      eq(key, value) { filters[key] = value; return builder; },
      or() { return builder; },
      order() { return builder; },
      insert(value) {
        record = { id: `request-${state[table].length + 1}`, ...value };
        state[table].push(record);
        return builder;
      },
      async maybeSingle() { return { data: company, error: null }; },
      async single() { return { data: table === 'companies' ? company : record, error: null }; },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    };
    return builder;
  } };
  const cache = new Map();
  const adapters = {
    '@supabase/supabase-js': { createClient: () => client },
    resend: { Resend: class {
      emails = { send: async (email) => { state.emails.push(email); return { data: { id: 'email' } }; } };
    } },
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const localRequire = createRequire(filename);
    const module = { exports: {} };
    const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(code, {
      module, exports: module.exports,
      require(id) {
        if (adapters[id]) return adapters[id];
        if (id.endsWith('/web-push')) return { sendCompanyPush: async (...args) => state.pushes.push(args) };
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
      Buffer, URL, Date, Intl, console: { log() {}, error() {} },
    }, { filename });
    cache.set(filename, module.exports);
    return module.exports;
  }
  async function request(body, method = 'POST', query = {}, companyEndpoint = false) {
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; },
    };
    const handler = load(path.resolve(__dirname,
      companyEndpoint ? '../api/company/reservations.ts' : '../api/reservations.ts'));
    await handler({ method, query, body, headers: { authorization: `Bearer ${Buffer.from(`${company.slug}:123456`).toString('base64')}` } }, res);
    return res;
  }
  return { state, request };
}

const salonPayload = {
  restaurantName: 'Atelier7', restaurantSlug: 'atelier7', restaurantEmail: 'salon@example.test',
  serviceType: 'friseur', service: 'Herrenhaarschnitt', serviceValue: 'herrenhaarschnitt',
  guestName: 'Testkunde', guestEmail: 'kunde@example.test', phone: '0911000000',
  date: '2099-11-04', time: '14:00', people: 1, bookingLocation: 'salon',
};
const homePayload = {
  ...salonPayload, bookingLocation: 'home',
  homeVisitAddress: { street: 'Teststraße', houseNumber: '7a', postalCode: '90429', city: 'Nürnberg', details: 'Klingel Müller, 2. Stock' },
};

test('a home visit remains a request, preserves the address and sends no automatic guest confirmation', async () => {
  const { state, request } = setup();
  const result = await request(homePayload);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.requestMode, true);
  assert.equal(state.reservations.length, 0);
  assert.equal(state.booking_requests.length, 1);
  assert.match(state.booking_requests[0].note, /Buchungsort: Hausbesuch/);
  assert.match(state.booking_requests[0].note, /Teststraße 7a, 90429 Nürnberg/);
  assert.equal(state.emails.length, 1);
  assert.equal(state.emails[0].to, 'salon@example.test');
  assert.match(state.emails[0].html, /Teststraße 7a, 90429 Nürnberg/);
  assert.match(state.emails[0].text, /Klingel Müller, 2. Stock/);

  const calendar = await request({}, 'GET', { date: homePayload.date }, true);
  assert.equal(calendar.statusCode, 200);
  assert.equal(calendar.body[0].isRequest, true);
  assert.equal(calendar.body[0].bookingLocation, 'home');
  assert.equal(calendar.body[0].visitAddress, 'Teststraße 7a, 90429 Nürnberg');
  assert.equal(calendar.body[0].visitDetails, 'Klingel Müller, 2. Stock');
});

test('pending home visits do not block another request at the same time', async () => {
  const { state, request } = setup();
  assert.equal((await request(homePayload)).statusCode, 200);
  assert.equal((await request(homePayload)).statusCode, 200);
  assert.equal(state.booking_requests.length, 2);
  const availability = await request({}, 'GET', { restaurantSlug: 'atelier7', date: homePayload.date });
  assert.equal(Object.keys(availability.body.slots).length, 0);
});

for (const [label, address] of [
  ['missing address', undefined],
  ['missing house number', { ...homePayload.homeVisitAddress, houseNumber: '' }],
  ['invalid postal code', { ...homePayload.homeVisitAddress, postalCode: '9042x' }],
  ['empty city', { ...homePayload.homeVisitAddress, city: '   ' }],
  ['overlong directions', { ...homePayload.homeVisitAddress, details: 'x'.repeat(301) }],
]) {
  test(`rejects ${label} without writing or sending email`, async () => {
    const { state, request } = setup();
    const result = await request({ ...homePayload, homeVisitAddress: address });
    assert.equal(result.statusCode, 400);
    assert.equal(state.booking_requests.length, 0);
    assert.equal(state.emails.length, 0);
  });
}

test('switching back to salon discards a previously entered home address', async () => {
  const { state, request } = setup();
  const result = await request({ ...homePayload, bookingLocation: 'salon' });
  assert.equal(result.body.requestMode, true);
  assert.match(state.booking_requests[0].note, /Buchungsort: Im Salon/);
  assert.doesNotMatch(state.booking_requests[0].note, /Teststraße|Klingel/);
  assert.doesNotMatch(state.emails[0].html, /Teststraße|Klingel/);
});

test('another salon cannot enable home visits by changing the request payload', async () => {
  const { state, request } = setup({ slug: 'another-salon' });
  assert.equal((await request({ ...homePayload, restaurantSlug: 'another-salon' })).statusCode, 400);
  assert.equal(state.booking_requests.length, 0);
});

test('unknown booking locations are rejected', async () => {
  const { request } = setup();
  assert.equal((await request({ ...salonPayload, bookingLocation: 'elsewhere' })).statusCode, 400);
});

test('manual blocks still prevent requests', async () => {
  const { state, request } = setup();
  state.reservations.push({ restaurant_slug: 'atelier7', date: homePayload.date, time: homePayload.time, note: '__BLOCK__:test' });
  assert.equal((await request(homePayload)).statusCode, 409);
  assert.equal(state.booking_requests.length, 0);
});

test('other salons keep their existing direct booking behavior', async () => {
  const { state, request } = setup({ slug: 'another-salon' });
  const result = await request({ ...salonPayload, restaurantSlug: 'another-salon' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.requestMode, false);
  assert.equal(state.reservations.length, 1);
  assert.equal(state.booking_requests.length, 0);
  assert.equal(state.emails.length, 2);
});

for (const serviceType of ['friseur', 'restaurant']) {
  test(`preserves ordinary address notes for another ${serviceType}`, async () => {
    const slug = `other-${serviceType}`;
    const { state, request } = setup({ slug, service_type: serviceType });
    state.reservations.push({
      id: 'existing', restaurant_slug: slug, date: salonPayload.date, time: '10:00',
      note: 'Notiz: Bitte anrufen | Adresse: Büro 7 | Buchungsort: Hausbesuch | Hinweise zum Hausbesuch: Eingang links',
    });
    const calendar = await request({}, 'GET', { date: salonPayload.date }, true);
    assert.equal(calendar.statusCode, 200);
    assert.equal(calendar.body[0].note,
      'Bitte anrufen | Adresse: Büro 7 | Buchungsort: Hausbesuch | Hinweise zum Hausbesuch: Eingang links');
    assert.equal(Object.hasOwn(calendar.body[0], 'bookingLocation'), false);
    assert.equal(Object.hasOwn(calendar.body[0], 'visitAddress'), false);
  });
}

test('a restaurant with the Atelier7 slug does not acquire the salon-specific request mode', async () => {
  const { state, request } = setup({ service_type: 'restaurant' });
  const result = await request({ ...salonPayload, serviceType: 'restaurant', seating: 'Tisch drinnen' });
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.requestMode, false);
  assert.equal(state.reservations.length, 1);
  assert.doesNotMatch(state.reservations[0].note, /Buchungsort:/);
});
