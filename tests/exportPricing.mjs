import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const module = { exports: {} };
const code = ts.transpileModule(readFileSync(new URL('../lib/pricing/exportPricing.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
new Function('exports', code)(module.exports);
const { calculateExportPricing } = module.exports;
const cabinets = [{ price: 1000 }, { price: 500 }];
for (const [length, price] of [[0, 0], [205, 297.25], [206, 298.70], [410, 594.50], [411, 595.95], [615, 891.75], [616, 893.20]]) {
  const result = calculateExportPricing(cabinets, 'linear', { wallA: length });
  assert.equal(result.cabinetSubtotal, 1500);
  assert.equal(result.worktopPrice, price);
  assert.equal(result.total, 1500 + price, 'full cabinet subtotal plus listed worktop price');
}
const corner = calculateExportPricing(cabinets, 'l-shape', { wallA: 300, wallB: 180 });
assert.equal(corner.worktopLengthCm, 420);
assert.equal(corner.total, 2109);
const island = calculateExportPricing(cabinets, 'linear', { wallA: 300, hasIsland: true, islandWidth: 180 });
assert.equal(island.total, 2196);
assert.equal(calculateExportPricing([{ price: 1000.12 }, { price: 500.34 }], 'linear', { wallA: 205 }).total, 1797.71);
console.log('PASS: undiscounted document totals, worktop per-metre pricing, L-shape/island and decimal prices');
