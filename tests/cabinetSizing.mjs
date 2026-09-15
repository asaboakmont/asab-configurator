import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
const compiled = ts.transpileModule(readFileSync(new URL('../lib/asab/cabinetSizing.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { cabinetWidthScale, customCabinetLabel, resizeCabinetAtOrigin } = exports;
const base = { width: 60, height: 72, depth: 53, xPos: 100, wall: 'A' };
for (const wall of ['A', 'B', 'C', 'I', 'P']) {
 for (const runSide of ['left', 'right']) {
  const cabinet = { ...base, wall, runSide };
  const resized = resizeCabinetAtOrigin(cabinet, 75, 60);
  const origin = c => c.wall === 'B' || (c.wall === 'P' && c.runSide === 'left') ? c.xPos + c.width : c.xPos;
  assert.equal(origin(resized), origin(cabinet));
  assert.equal(resized.width, 75);
  assert.deepEqual(resizeCabinetAtOrigin(resized, 60, 60).xPos, cabinet.xPos);
 }
}
for (const rotationYDegrees of [0, 90, 180, 270]) {
 const cabinet = { ...base, placementMode: 'free', freePosition: { x: 130, z: 100 }, rotationYDegrees };
 const angle = rotationYDegrees * Math.PI / 180;
 const origin = c => new THREE.Vector3(c.freePosition.x, 0, c.freePosition.z).add(new THREE.Vector3(-c.width / 2, 0, -c.depth / 2).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle));
 for (const width of [30, 75, 120]) {
  const resized = resizeCabinetAtOrigin(cabinet, width, 60);
  assert.ok(origin(resized).distanceTo(origin(cabinet)) < 1e-10);
  const root = new THREE.Group(); root.position.copy(origin(cabinet)); root.rotation.y = angle;
  root.scale.set(cabinetWidthScale(width, 60), 1, 1); root.updateMatrixWorld();
  assert.ok(root.localToWorld(new THREE.Vector3()).distanceTo(origin(cabinet)) < 1e-10);
  const extent = new THREE.Vector3(60, 0, 0).applyMatrix4(root.matrixWorld).distanceTo(origin(cabinet));
  assert.ok(Math.abs(extent - width) < 1e-10);
 }
}
assert.equal(customCabinetLabel('Corp', true), 'Corp ***dimensiune personalizata');
assert.equal(customCabinetLabel(customCabinetLabel('Corp', true), true), 'Corp ***dimensiune personalizata');
assert.equal(customCabinetLabel('Corp ***dimensiune personalizata', false), 'Corp');
assert.equal(cabinetWidthScale(75, 60), 1.25);
console.log('PASS: width scaling, wall/free origins for all rotations, reset and custom labels');
