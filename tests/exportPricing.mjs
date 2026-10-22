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
for (const [length, price] of [[0, 0], [205, 370], [206, 740], [410, 740], [411, 1110], [615, 1110], [616, 1480]]) {
  const result = calculateExportPricing(cabinets, 'linear', { wallA: length });
  assert.equal(result.cabinetSubtotal, 1500);
  assert.equal(result.worktopPrice, price);
  assert.equal(result.total, 1500 + price, 'full cabinet subtotal plus listed worktop price');
}
const corner = calculateExportPricing(cabinets, 'l-shape', { wallA: 300, wallB: 180 });
assert.equal(corner.worktopLengthCm, 420);
assert.equal(corner.total, 2610);
const island = calculateExportPricing(cabinets, 'linear', { wallA: 300, hasIsland: true, islandWidth: 180 });
assert.equal(island.total, 2610);
assert.equal(calculateExportPricing([{ price: 1000.12 }, { price: 500.34 }], 'linear', { wallA: 205 }).total, 1870.46);
console.log('PASS: undiscounted document totals, stock worktop pricing, L-shape/island and decimal prices');

const {allocateWorktopBoards}=module.exports;
assert.equal(allocateWorktopBoards([300,300]).fullWorktops,2);
assert.equal(allocateWorktopBoards([200,200]).fullWorktops,1);
assert.equal(allocateWorktopBoards([206,206,206]).fullWorktops,3);
assert.equal(allocateWorktopBoards([0]).stockLengthCm,0);
assert.equal(allocateWorktopBoards([205.001]).fullWorktops,1);
for(const lengths of [[300,120],[300,300],[200,200],[206,206,206],[410,205],[600,200]]){const packed=allocateWorktopBoards(lengths);assert(packed.boards.every(b=>b.cutsCm.reduce((s,n)=>s+n,0)<=b.lengthCm));assert.equal(packed.boards.flatMap(b=>b.cutsCm).reduce((s,n)=>s+n,0),lengths.reduce((s,n)=>s+n,0));}
console.log('PASS: half/full board allocation respects continuous-cut fit, including two 300 cm pieces.');
