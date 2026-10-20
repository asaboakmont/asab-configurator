import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const code = ts.transpileModule(readFileSync(new URL('../lib/asab/cabinetModelGeometry.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exports = {};
new Function('require', 'exports', code)(() => THREE, exports);
const { bakeCabinetMeshGeometry } = exports;
let tested = 0;
async function checkScene(scene) {
 scene.updateMatrixWorld(true);
 scene.traverse(mesh => {
  if (!mesh.isMesh) return;
  const original = mesh.geometry.attributes.position;
  const before = Array.from(original.array);
  const geometry = bakeCabinetMeshGeometry(mesh);
  const vertices = geometry.attributes.position;
  for (let i = 0; i < vertices.count; i += Math.max(1, Math.floor(vertices.count / 30))) {
   const expected = new THREE.Vector3().fromBufferAttribute(original, i).applyMatrix4(mesh.matrixWorld);
   const actual = new THREE.Vector3().fromBufferAttribute(vertices, i);
   assert.ok(actual.distanceTo(expected) < 1e-4, `part displaced: ${mesh.name}`);
  }
  assert.deepEqual(Array.from(original.array), before);
  geometry.computeBoundingBox();
  const width = geometry.boundingBox.max.x - geometry.boundingBox.min.x;
  geometry.scale(1.25, 1, 1); geometry.computeBoundingBox();
  assert.ok(Math.abs((geometry.boundingBox.max.x - geometry.boundingBox.min.x) - width * 1.25) < 1e-4);
  geometry.dispose(); tested++;
 });
}
for (const [collection, suffix] of [['japandi','jpn'], ['franc','frc'], ['germain','grm']]) {
 for (const sku of ['1004','1010','1015']) {
  const bytes = readFileSync(new URL(`../public/${collection}/${sku}-${suffix}.glb`, import.meta.url));
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  await checkScene(gltf.scene);
 }
}
const root = new THREE.Group(); root.position.set(3, 4, 5); root.rotation.y = .4;
const parent = new THREE.Group(); parent.scale.set(2, .5, 3); parent.rotation.x = .3; root.add(parent);
const mesh = new THREE.Mesh(new THREE.BoxGeometry()); mesh.position.set(7, 8, 9); parent.add(mesh);
await checkScene(root);
console.log(`PASS: ${tested} real/synthetic meshes preserve complete transforms and source geometry during resizing`);
