import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function compile(path, dependencies = {}) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}
process.env.ASAB_INTERNAL_SESSION_SECRET = 'local-test-secret';
process.env.UPSTASH_REDIS_REST_URL = 'https://test.invalid';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test';
process.env.RESEND_API_KEY = 'test';
const auth = compile('../lib/auth/internalSession.ts');
let saved = 0, emailed = 0;
const { POST } = compile('../app/api/config/save/route.ts', {
  '@/lib/auth/internalSession': auth,
  'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  '@upstash/redis': { Redis: class { async set() { saved++; } } },
  resend: { Resend: class { emails = { send: async () => { emailed++; return { data: {} }; } }; } },
  nanoid: { nanoid: () => 'test-id' },
});
const request = (body, token) => ({ json: async () => body, cookies: { get: () => token ? { value: token } : undefined } });
for (const role of ['admin', 'designer']) {
  const token = auth.createInternalSession(role);
  assert.equal((await POST(request({ config: { cabinets: [{ isCustom: true }] } }, token))).status, 200);
}
assert.equal(saved, 2);
assert.equal(emailed, 0);
for (const body of [{}, { email: 'a@example.com' }, { phone: '123' }, { email: 'invalid', phone: '123', internalRole: 'admin' }]) {
  assert.equal((await POST(request(body))).status, 400);
}
assert.equal((await POST(request({ config: {} }, 'invalid.token'))).status, 400);
const customer = { config: {}, name: 'Customer', email: 'a@example.com', phone: '123' };
assert.equal((await POST(request(customer))).status, 200);
assert.equal(emailed, 2);
assert.equal((await POST(request({ ...customer, config: { cabinets: [{ isCustom: true }] } }))).status, 403);
const token = auth.createInternalSession('admin');
assert.equal(auth.getInternalRole(request({}, token + '.extra')), null);
const now = Date.now;
Date.now = () => now() + 13 * 60 * 60 * 1000;
assert.equal(auth.getInternalRole(request({}, token)), null);
Date.now = now;
delete process.env.ASAB_INTERNAL_SESSION_SECRET;
assert.equal(auth.getInternalRole(request({}, token)), null);
console.log('PASS: internal saves, customer contact validation and emails, forged/expired sessions');
