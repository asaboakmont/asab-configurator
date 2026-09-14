import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import ts from 'typescript';

const source = new URL('../lib/auth/internalSession.ts', import.meta.url);
const compiled = new URL('./.internalSession-test.mjs', import.meta.url);
writeFileSync(compiled, ts.transpileModule(readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText);

try {
  process.env.ASAB_INTERNAL_SESSION_SECRET = 'test-secret-with-sufficient-entropy';
  process.env.ASAB_ADMIN_PASSWORD = 'correct-admin-password';
  const auth = await import(`${compiled.href}?t=${Date.now()}`);

  assert.equal(auth.authenticateInternalUser('admin', 'wrong'), null);
  assert.equal(auth.authenticateInternalUser('admin', 'correct-admin-password'), 'admin');
  const token = auth.createInternalSession('designer');
  const request = { cookies: { get: () => ({ value: token }) } };
  assert.equal(auth.getInternalRole(request), 'designer');
  assert.equal(auth.usesInternalCabinetFeatures({ cabinets: [{ width: 60 }] }), false);
  assert.equal(auth.usesInternalCabinetFeatures({ cabinets: [{ width: 73.4, standardWidth: 60, isCustom: true }] }), true);
  assert.equal(auth.usesInternalCabinetFeatures({ config: { cabinets: [{ placementMode: 'free' }] } }), true);

  console.log('PASS: credentials, signed roles, and internal-feature detection');
} finally {
  unlinkSync(compiled);
}
