const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const ts = require('typescript');

// Vercel resolves the entrypoint's nearest tsconfig and uses it for dependencies
// too. Load the emitted files in Node itself, without rewriting module imports.
test('deployed API handlers start with their actual TypeScript configuration', () => {
  const root = path.resolve(__dirname, '..');
  const configPath = ts.findConfigFile(path.join(root, 'api'), ts.sys.fileExists);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const { options } = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'nextime-api-runtime-'));
  const handlers = [
    'api/companies.ts',
    'api/reservations.ts',
    'api/company/reservations.ts',
    'api/company/stats.ts',
    'api/admin-stats.ts',
    'api/booking-requests/approve.ts',
    'api/booking-requests/reject.ts',
  ];
  const files = [
    ...handlers,
    'src/app/shared/booking-location.ts',
    ...fs.readdirSync(path.join(root, 'api/_lib'))
      .filter((file) => file.endsWith('.ts'))
      .map((file) => `api/_lib/${file}`),
  ];
  try {
    for (const file of files) {
      const filename = path.join(root, file);
      const target = path.join(output, file.replace(/\.ts$/, '.js'));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: options,
        fileName: filename,
      });
      fs.writeFileSync(target, result.outputText);
    }
    fs.writeFileSync(path.join(output, 'package.json'), '{"type":"commonjs"}');
    for (const handler of handlers) {
      const filename = path.join(output, handler.replace(/\.ts$/, '.js'));
      const script = `require('node:assert/strict').equal(typeof require(${JSON.stringify(filename)}), 'function')`;
      const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
      assert.equal(result.status, 0, `${handler} failed to start:\n${result.stderr}`);
    }
    const exerciseCompanies = String.raw`
      const assert = require('node:assert/strict');
      const Module = require('node:module');
      const rows = [
        { id: '1', name: 'Atelier7', slug: 'atelier7', service_type: 'friseur', booking_mode: 'confirm', show_service_prices: true },
        { id: '2', name: 'Anderer Salon', slug: 'anderer-salon', service_type: 'friseur', booking_mode: 'confirm', show_service_prices: true },
      ];
      const originalLoad = Module._load;
      Module._load = function (id, ...args) {
        if (id === '@supabase/supabase-js') return { createClient: () => ({ from() {
          let slug;
          return {
            select() { return this; },
            eq(key, value) { if (key === 'slug') slug = value; return this; },
            async single() { return { data: rows.find(row => row.slug === slug), error: null }; },
            async order() { return { data: rows, error: null }; },
          };
        } }) };
        return originalLoad.call(this, id, ...args);
      };
      process.env.SUPABASE_URL = 'https://database.example.test';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
      const handler = require(process.argv[1]);
      async function get(query) {
        const response = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        await handler({ method: 'GET', query }, response);
        assert.equal(response.statusCode, 200);
        return response.body;
      }
      (async () => {
        const companies = await get({});
        assert.deepEqual(companies.map(company => company.slug), ['atelier7', 'anderer-salon']);
        const atelier = await get({ slug: 'atelier7' });
        assert.equal(atelier.bookingMode, 'request');
        assert.equal(atelier.showServicePrices, false);
        const other = await get({ slug: 'anderer-salon' });
        assert.equal(other.bookingMode, 'confirm');
        assert.equal(other.showServicePrices, true);
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `;
    const result = spawnSync(process.execPath, [
      '-e', exerciseCompanies, path.join(output, 'api/companies.js'),
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, `Company list/profile requests failed:\n${result.stderr}`);
  } finally {
    fs.rmSync(output, { recursive: true, force: true });
  }
});
