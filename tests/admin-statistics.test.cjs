const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const ts = require('typescript');
const file = path.resolve(__dirname, '../src/app/shared/admin-statistics.ts');
const loaded = new Module(file, module);
loaded._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { adminStatsRange, berlinDay, buildAdminStats, collectAdminStatsActivities, statsChangePercent } = loaded.exports;
const now = new Date('2026-11-06T10:00:00Z');
const companies = [{ slug: 'atelier7', name: 'Atelier7', serviceType: 'friseur' }, { slug: 'restaurant', name: 'Restaurant', serviceType: 'restaurant' }, { slug: 'quiet', name: 'Ohne Aktivität' }];
const activity = (day, kind = 'booking', slug = 'atelier7') => ({ day, kind, slug });

test('compares the current month only with elapsed days in the previous month', () => {
  const range = adminStatsRange('this-month', null, now);
  assert.deepEqual([range.from, range.to, range.previousFrom, range.previousTo, range.mode], ['2026-11-01', '2026-11-06', '2026-10-01', '2026-10-06', 'month-to-date']);
  assert.deepEqual(adminStatsRange('month', '2026-11', now), { ...range, period: 'month' });
  const previous = adminStatsRange('last-month', null, now);
  assert.deepEqual([previous.from, previous.to, previous.previousFrom, previous.previousTo], ['2026-10-01', '2026-10-31', '2026-09-01', '2026-09-30']);
});

test('handles leap years, year rollover, shorter previous months and Berlin midnight', () => {
  const leap = adminStatsRange('month', '2024-03', now);
  assert.equal(leap.previousTo, '2024-02-29');
  const january = adminStatsRange('this-month', null, new Date('2026-12-31T23:30:00Z'));
  assert.deepEqual([january.from, january.to, january.previousFrom, january.previousTo], ['2027-01-01', '2027-01-01', '2026-12-01', '2026-12-01']);
  const shorter = adminStatsRange('this-month', null, new Date('2026-03-31T10:00:00Z'));
  assert.equal(shorter.previousTo, '2026-02-28');
  assert.equal(berlinDay('2026-03-28T23:30:00Z'), '2026-03-29');
  assert.equal(berlinDay('2026-10-25T23:30:00Z'), '2026-10-26');
  assert.equal(berlinDay('invalid'), null);
});

test('rolling periods contain exactly 30 days each, and invalid/future months fall back safely', () => {
  const range = adminStatsRange('last-30-days', null, now);
  assert.deepEqual([range.from, range.to, range.previousFrom, range.previousTo], ['2026-10-08', '2026-11-06', '2026-09-08', '2026-10-07']);
  for (const month of ['2026-13', '2026-00', '2026-12', '', 'bad', '1999-01']) assert.equal(adminStatsRange('month', month, now).period, 'this-month');
});

test('counts approved requests once on reception date, including the missing-status fallback', () => {
  const requests = [
    { id: 'linked', restaurant_slug: 'atelier7', created_at: '2026-10-31T23:30:00Z' },
    { id: 'open', restaurant_slug: 'atelier7', status: 'pending', created_at: '2026-11-02T10:00:00Z' },
    { id: 'rejected', restaurant_slug: 'atelier7', status: 'rejected', created_at: '2026-11-02T10:00:00Z' },
    { id: 'approved', restaurant_slug: 'atelier7', status: 'approved', created_at: '2026-11-02T10:00:00Z' },
  ];
  const reservations = [
    { restaurant_slug: 'atelier7', guest_email: 'test@example.test', booking_request_id: 'linked', created_at: '2026-12-01T10:00:00Z' },
    { restaurant_slug: 'atelier7', guest_email: 'test@example.test', note: '__BLOCK__:1', created_at: '2026-11-02T10:00:00Z' },
    { restaurant_slug: 'atelier7', guest_email: 'test@example.test', note: '__INTERNAL__:1', created_at: '2026-11-02T10:00:00Z' },
    { restaurant_slug: 'atelier7', guest_email: ' ', created_at: '2026-11-02T10:00:00Z' },
  ];
  assert.deepEqual(collectAdminStatsActivities(reservations, requests), [activity('2026-11-01'), activity('2026-11-02', 'request')]);
});

test('summary, per-company comparisons, active companies and monthly totals agree', () => {
  const stats = buildAdminStats(companies, [activity('2026-11-01'), activity('2026-11-06', 'request'), activity('2026-11-02', 'booking', 'restaurant'), activity('2026-10-03'), activity('2026-10-07'), activity('2026-11-07'), activity('2026-11-01', 'booking', 'deleted-company')], 'this-month', null, now);
  assert.deepEqual([stats.bookingsTotal, stats.requestsTotal, stats.interactionsTotal, stats.activeCompanies, stats.companiesTotal], [2, 1, 3, 2, 3]);
  assert.deepEqual([stats.comparison.interactionsTotal, stats.comparison.activeCompanies, stats.comparison.to], [1, 1, '2026-10-06']);
  assert.deepEqual([stats.rows[0].total, stats.rows[0].previousTotal, stats.rows[0].changePercent, stats.rows[0].change], [2, 1, 100, 1]);
  assert.deepEqual([stats.rows[1].previousTotal, stats.rows[1].changePercent], [0, null]);
  assert.equal(stats.rows.find(row => row.slug === 'quiet').changePercent, 0);
  assert.equal(stats.rows.reduce((total, row) => total + row.total, 0), stats.interactionsTotal);
  assert.equal(stats.monthlyTrend.length, 6);
  assert.deepEqual(stats.monthlyTrend.slice(-2).map(point => [point.month, point.total]), [['2026-10', 2], ['2026-11', 3]]);
});

test('all-time totals have no misleading comparison and zero baselines never divide by zero', () => {
  const stats = buildAdminStats(companies, [activity('2020-01-01')], 'all', null, now);
  assert.equal(stats.comparison, null); assert.equal(stats.from, null); assert.equal(stats.interactionsTotal, 1);
  assert.equal(stats.rows[0].previousTotal, null); assert.equal(stats.rows[0].change, null);
  assert.equal(statsChangePercent(0, 0), 0); assert.equal(statsChangePercent(5, 0), null);
  assert.equal(statsChangePercent(0, 5), -100); assert.equal(statsChangePercent(7, 6), 16.7);
});
