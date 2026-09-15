import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
const code = ts.transpileModule(readFileSync(new URL('../lib/asab/handleScaling.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const exports = {};
new Function('require', 'exports', code)(name => { assert.equal(name, 'three'); return THREE; }, exports);
const { handleScaleCompensation } = exports;
const geometry = new THREE.BoxGeometry(1.28, .12, .2);
geometry.translate(2, 1, .3); // Test models with geometry offset from their origin.
for (const collection of ['japandi', 'franc', 'germain']) {
 for (const widthScale of [.5, 1, 1.5, 2]) {
  for (const mirrored of [false, true]) {
   for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const position = [1, 2, .4], rotation = [.2, .4, .6], scale = [1, 1.2, .8];
    const root = new THREE.Group(); root.position.set(30, 4, 10); root.rotation.y = angle; root.scale.x = widthScale;
    const mirror = new THREE.Group(); mirror.scale.x = mirrored ? -1 : 1; mirror.position.x = mirrored ? 6 : 0; root.add(mirror);
    const compensation = handleScaleCompensation(geometry, position, rotation, scale, widthScale, collection);
    const wrapper = new THREE.Group(); wrapper.position.fromArray(compensation.position); wrapper.scale.fromArray(compensation.scale); mirror.add(wrapper);
    const mesh = new THREE.Mesh(geometry); mesh.position.fromArray(position); mesh.rotation.set(...rotation); mesh.scale.fromArray(scale); wrapper.add(mesh);
    root.updateMatrixWorld(true);
    const vertices = geometry.attributes.position;
    const p = index => new THREE.Vector3().fromBufferAttribute(vertices, index);
    const worldDistance = p(0).applyMatrix4(mesh.matrixWorld).distanceTo(p(7).applyMatrix4(mesh.matrixWorld));
    const nativeMatrix = new THREE.Matrix4().compose(mesh.position, mesh.quaternion, mesh.scale);
    const nativeDistance = p(0).applyMatrix4(nativeMatrix).distanceTo(p(7).applyMatrix4(nativeMatrix));
    if (collection !== 'germain') assert.ok(Math.abs(worldDistance - nativeDistance) < 1e-9, `${collection} handle distorted`);
    else assert.deepEqual(compensation, { position: [0, 0, 0], scale: [1, 1, 1] });
    geometry.computeBoundingBox();
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    const expected = center.clone().applyMatrix4(nativeMatrix).applyMatrix4(mirror.matrixWorld);
    assert.ok(center.applyMatrix4(mesh.matrixWorld).distanceTo(expected) < 1e-9, 'handle centre must follow resized door');
   }
  }
 }
}
console.log('PASS: Japandi/Franc handle size and placement; Germain scaling; mirrored doors and all wall rotations');
