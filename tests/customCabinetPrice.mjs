import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import ts from 'typescript';

const source = new URL('../lib/pricing/customCabinetPrice.ts', import.meta.url);
const compiled = new URL('./.customCabinetPrice-test.mjs', import.meta.url);
writeFileSync(compiled, ts.transpileModule(readFileSync(source, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText);

try {
  const { calculateCustomCabinetPrice } = await import(`${compiled.href}?t=${Date.now()}`);
  const pricing = {
    extraWidthPerMeter: 350,
    customSurchargePercent: 15,
    minimumCustomPricePercent: 90,
  };

  assert.deepEqual(calculateCustomCabinetPrice({
    standardPrice: 500,
    standardWidth: 60,
    customWidth: 73.4,
    pricing,
  }), {
    standardPrice: 500,
    standardWidth: 60,
    customWidth: 73.4,
    dimensionalAdjustment: 112,
    customSurcharge: 75,
    minimumPrice: 450,
    finalPrice: 687,
  });

  assert.equal(calculateCustomCabinetPrice({
    standardPrice: 500,
    standardWidth: 60,
    customWidth: 20,
    pricing,
  }).finalPrice, 450);

  console.log('PASS: custom width adjustment, manufacturing surcharge, and minimum price');
} finally {
  unlinkSync(compiled);
}
