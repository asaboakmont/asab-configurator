import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
// Test the actual utility without requiring a separate TS runtime dependency.
const compiled = new URL('../lib/asab/.exportGLB-test.mjs', import.meta.url);
writeFileSync(compiled, ts.transpileModule(readFileSync(new URL('../lib/asab/exportGLB.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText);
try {
 const { buildGLBHierarchy, exportKitchenGLB } = await import(compiled.href);
 const scene = new THREE.Scene();
 const parent = new THREE.Group(); parent.position.set(3, 4, -7); parent.rotation.set(.2,.7,.1); parent.scale.set(2,3,4); scene.add(parent);
 const cabinet = new THREE.Group(); cabinet.name='cabinet'; cabinet.position.set(5,2,1); cabinet.rotation.y=.8;
 cabinet.userData={exportGLB:true, asab:{category:'cabinet',cabinetId:'cab-1',sku:'SKU'}}; parent.add(cabinet);
 const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); mesh.name='front'; mesh.scale.x=-1; cabinet.add(mesh);
 const excluded = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); excluded.userData.excludeFromGLB=true; cabinet.add(excluded);
 const camera = new THREE.PerspectiveCamera(); cabinet.add(camera);
 cabinet.add(new THREE.AxesHelper());
 scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
 const hidden = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({opacity:0,transparent:true})); hidden.name='wall'; hidden.visible=false; hidden.userData={exportGLB:true,exportOpaque:true,asab:{category:'wall'}}; scene.add(hidden);
 scene.updateMatrixWorld(true);
 const before = JSON.stringify(scene.toJSON());
 const result=buildGLBHierarchy(scene);
 assert.equal(result.meshes,2); assert.equal(result.counts.cabinet,1);
 const out=result.root.getObjectByName('front');
 assert.deepEqual(out.matrixWorld.elements,mesh.matrixWorld.elements);
 assert.equal(out.userData.asab.parentCabinetId,'cab-1');
 assert.equal(result.root.getObjectByName('wall').material.opacity,1);
 assert.equal(JSON.stringify(scene.toJSON()),before);
 assert.deepEqual(buildGLBHierarchy(cabinet).root.getObjectByName('front').matrixWorld.elements,mesh.matrixWorld.elements);
 assert.throws(()=>buildGLBHierarchy(new THREE.Scene()),/No design/);
 // Browser FileReader equivalent for the exporter's binary-only paths.
 globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();}); }
 };
 const {buffer}=await exportKitchenGLB(scene);
 const view=new DataView(buffer); assert.equal(view.getUint32(0,true),0x46546c67); assert.equal(view.getUint32(4,true),2);
 const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,view.getUint32(12,true))).trim());
 const exportRoot=json.nodes.find(n=>n.name==='ASAB-Kitchen');
 assert.ok(exportRoot);
 const exportedScale=exportRoot.scale?.[0] ?? exportRoot.matrix?.[0];
 assert.ok(Math.abs(exportedScale-0.1)<1e-8, `expected metre export scale 0.1, got ${exportedScale}`);
 assert.equal(exportRoot.extras.asab.units,'meters');
 assert.equal(exportRoot.extras.asab.sourceSceneUnitsPerMeter,10);
 assert.equal(json.nodes.filter(n=>n.extras?.asab?.cabinetId==='cab-1').length,1);
 assert.equal(json.cameras,undefined);
 assert.equal(JSON.stringify(scene.toJSON()),before);
 console.log('PASS: metre-scaled binary GLB, metadata, hierarchy/world matrices, mirrored scale, exclusions, hidden walls, subtree export and live-scene immutability');
} finally { unlinkSync(compiled); }
