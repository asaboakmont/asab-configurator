import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = process.env.ASAB_TEST_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'package.json')), ts = require('typescript');
const THREE = await import(pathToFileURL(path.join(root, 'node_modules/three/build/three.module.js')));
const { GLTFLoader } = await import(pathToFileURL(path.join(root, 'node_modules/three/examples/jsm/loaders/GLTFLoader.js')));
const cache = new Map();
function load(name) {
  const file = path.join(root, name.slice(2) + '.ts');
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  new Function('require', 'exports', 'module', code)(n => n === 'three' ? THREE : n.startsWith('@/') ? load(n) : require(n), module.exports, module);
  return module.exports;
}
const { NATIVE_CATALOGUE: rows, nativeModel, nativeProduct, compatibleDrainer } = load('@/lib/catalog/nativeCatalogue');
const { applyCollectionToCabinet: price, getSkuByCode, toCollectionSku, ALL_SKUS } = load('@/data/skus');
const { REVISED_CATALOGUE } = load('@/data/revisedCatalogue');
const { buildNativeModel, disposeNativeModel, nativePartCategory } = load('@/lib/asab/nativeModelGeometry');
const { calculateExportPricing } = load('@/lib/pricing/exportPricing');
assert.deepEqual(load('@/data/nativeCatalogueData').default, JSON.parse(fs.readFileSync(path.join(root, 'data/nativeCatalogue.json'), 'utf8')), 'generated data stays in sync');
assert.equal(rows.length, 335); assert.equal(new Set(rows.map(r => r.sku)).size, 335);
assert.equal(rows.filter(r => !r.active).length, 4);
for (const row of rows) {
  assert(fs.existsSync(path.join(root, 'public', row.modelUrl)), row.sku);
  if (row.collection === 'common') continue;
  const definition = getSkuByCode(row.sku);
  if (!row.active) { assert.equal(row.price, null); assert.equal(definition, undefined); continue; }
  assert.equal(definition.price, row.price);
  const key = row.baseSku.replace('-CPT-USA-', '-CPT-US-');
  const source = REVISED_CATALOGUE.find(r => r.sku === key);
  assert(source, key); assert.equal(row.price, source.prices[row.collection === 'smart' ? 'soho' : row.collection]);
  const c = price({ ...definition, sku: row.sku, wall: 'A', xPos: 0 }, row.collection);
  assert.equal(c.displaySku, row.sku); assert.equal(c.price, row.price);
  assert.equal(nativeModel(c, row.collection).sku, row.sku);
}
assert(!ALL_SKUS.some(r => r.sku.includes('CPT-SERTAR')));
assert.equal(toCollectionSku('ASAB-CS-1U-RAFT-W0600-JPN', 'smart'), 'ASAB-CS-1U-RAFT-W0600-SMT');
const base = { sku: '2010-jpn', baseSku: '2010', type: 'wall', width: 60, standardWidth: 60, height: 70, depth: 32, xPos: 0, wall: 'A', price: 1 };
let c = price(base, 'japandi'); const initial = c.price;
const drainer = compatibleDrainer(c, 'japandi'); assert(drainer); assert.equal(drainer.price, 100);
c = price({ ...c, drainerSku: drainer.sku }, 'japandi'); assert.equal(c.price, initial + 100);
assert.equal(price(c, 'japandi').price, c.price, 'restore must not add accessory twice');
const franc = price(c, 'franc'); assert.equal(franc.price, nativeProduct('2010', 60, 'franc').price + 100);
assert.equal(franc.drainerSku, drainer.sku);
assert.equal(price({ ...c, drainerSku: undefined }, 'japandi').price, initial);
for (const width of [40, 50, 60, 70, 80, 90]) {
 const wall = price({ ...base, sku: width >= 70 ? "2013-jpn" : base.sku, baseSku: width >= 70 ? "2013" : base.baseSku, width }, 'japandi'); const d = compatibleDrainer(wall, 'japandi');
 assert(d); assert.equal(d.widthMm, width * 10);
}
for (const width of [45, 55, 60.01, 62]) {
 const resized = price({ ...c, width }, 'japandi'); assert.equal(resized.drainerSku, undefined); assert.equal(compatibleDrainer(resized, 'japandi'), undefined);
}
for (const sku of ['ASAB-CS-HOTA-W0600', 'ASAB-CS-COLT-DR-W1000', 'ASAB-SP-1U-W0600', 'ASAB-CI-1U-RAFT-W0600']) {
 const model = rows.find(r => r.baseSku === sku && r.collection === 'japandi'); const d = getSkuByCode(model.sku);
 assert.equal(compatibleDrainer(price({ ...d, wall: 'A', xPos: 0 }, 'japandi'), 'japandi'), undefined);
}
assert.equal(calculateExportPricing([c], 'linear', { wallA: 60 }).cabinetSubtotal, c.price);
assert.equal(nativePartCategory('35_mm_hinge_cup_+_plate_-_DoorLeft_1'), 'hardware');
assert.equal(nativePartCategory('DoorLeft'), 'front'); assert.equal(nativePartCategory('BlindFixedPanel'), 'carcass');
const colorway = { doorHex: '#cc9988', carcassHex: '#eeeeee', handleHex: '#222222', finish: 'mat' };
async function parse(product) {
 const b = fs.readFileSync(path.join(root, 'public', product.modelUrl));
 const gltf = await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
 gltf.scene.updateMatrixWorld(true); return gltf.scene;
}
for (const collection of ['smart', 'japandi', 'germain', 'franc']) {
 for (const sku of ['ASAB-CS-1U-RAFT-W0600', 'ASAB-CI-COLT-STG-W0950', 'ASAB-CA-2UV-W0600']) {
  const product = rows.find(r => r.baseSku === sku && r.collection === collection);
  const definition = getSkuByCode(product.sku); const cabinet = price({ ...definition, sku: product.sku, wall: 'A', xPos: 0 }, collection);
  const source = await parse(product); const before = new THREE.Box3().setFromObject(source);
  const accessory = sku.startsWith('ASAB-CS-1U') ? await parse(drainer) : undefined;
  const model = buildNativeModel(source, product, { ...cabinet, drainerSku: accessory ? drainer.sku : undefined }, colorway, accessory);
  const bounds = new THREE.Box3().setFromObject(model);
  assert(Math.abs(bounds.getSize(new THREE.Vector3()).x - cabinet.width * .1) < .001, product.sku);
  if (product.legHeightMm) assert(Math.abs(bounds.min.y + cabinet.height * .05) < .003, 'feet at floor');
  if (accessory) {
   assert(!model.children.some(m => /^Shelf/.test(m.name)));
   const b = new THREE.Box3(); model.children.filter(m => m.userData.asab.category === 'drainer').forEach(m => b.union(new THREE.Box3().setFromObject(m)));
   assert(b.min.x >= -3 + .179 && b.max.x <= 3 - .179, 'drainer between side panels');
   assert(b.min.y >= -3.5 + .18 && b.max.y <= 3.5 - .18, 'drainer inside cabinet height');
   assert(b.min.z >= -1.59 + .001 && b.max.z <= 1.59 - .18, 'drainer behind front and ahead of back');
   if (collection === 'japandi') assert(!model.children.some(m => m.userData.asab.category === 'handle'));
  }
  assert(new THREE.Box3().setFromObject(source).equals(before), 'cached sources immutable');
  const resized = buildNativeModel(source, product, { ...cabinet, width: cabinet.width * 1.2 }, colorway);
  assert(Math.abs(new THREE.Box3().setFromObject(resized).getSize(new THREE.Vector3()).x - cabinet.width * .12) < .001);
  assert(Math.abs(new THREE.Box3().setFromObject(resized).getSize(new THREE.Vector3()).y - bounds.getSize(new THREE.Vector3()).y) < .001);
  disposeNativeModel(model); disposeNativeModel(resized);
 }
}
console.log('PASS: 335 models, approved prices/SKUs, four unpriced variants blocked, collection switching, exact-width drainer fit/pricing, real GLB bounds, shelves, hardware semantics and width-only resizing.');
