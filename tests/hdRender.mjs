import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';
const code = ts.transpileModule(readFileSync(new URL('../lib/render/hdRender.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const exports = {};
const cameraExports={};
new Function('require','exports',ts.transpileModule(readFileSync(new URL('../lib/render/exportCameras.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(()=>THREE,cameraExports);
new Function('require','exports',code)(name=>{if(name==='@/lib/render/exportCameras')return cameraExports;assert.equal(name,'three');return THREE;},exports);
const {prepareHDScene, hdRenderKey, DEFAULT_HD_SETTINGS}=exports;
const key=hdRenderKey('left','hd',DEFAULT_HD_SETTINGS);
for(const [field,value] of [['exposure',1.4],['lighting',.8],['samples',32]])assert.notEqual(key,hdRenderKey('left','hd',{...DEFAULT_HD_SETTINGS,[field]:value}));
assert.notEqual(key,hdRenderKey('right','hd',DEFAULT_HD_SETTINGS));
assert.notEqual(key,hdRenderKey('left','qhd',DEFAULT_HD_SETTINGS));
assert.equal(key,hdRenderKey('left','hd',{...DEFAULT_HD_SETTINGS}));
for (const mirrored of [false,true]) for(const angle of ['front','left','right']) {
 const source=new THREE.Scene(), parent=new THREE.Group();parent.position.set(10,0,5);parent.rotation.y=.3;source.add(parent);
 const root=new THREE.Group(); root.userData={exportGLB:true,asab:{asabType:'cabinet',category:'cabinet'}};root.scale.x=mirrored?-1:1;parent.add(root);
 const original=new THREE.Mesh(new THREE.BoxGeometry(6,20,5),new THREE.MeshStandardMaterial({color:'#e3c6a5'}));original.position.set(3,10,3);root.add(original);
 const ui=new THREE.Mesh(new THREE.BoxGeometry(100,100,100),new THREE.MeshBasicMaterial());source.add(ui);
 source.updateMatrixWorld(true);
 const matrix=original.matrixWorld.clone(), colour=original.material.color.clone();
 let sourceDisposed=false;original.geometry.addEventListener('dispose',()=>sourceDisposed=true);original.material.addEventListener('dispose',()=>sourceDisposed=true);
 const result=prepareHDScene(source,angle);assert.equal(result.scene.children.length,1);
 const copy=result.scene.children[0];assert.notEqual(copy.geometry,original.geometry);assert.notEqual(copy.material,original.material);assert.ok(copy.matrixWorld.equals(matrix));assert.ok(copy.material.color.equals(colour));
 const bounds=new THREE.Box3().setFromObject(copy);
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) {
 const p=new THREE.Vector3(x,y,z).project(result.camera);assert.ok(Math.abs(p.x)<1 && Math.abs(p.y)<1 && p.z<1 && p.z>-1,'Cabinet must fit export camera');
 }
 result.dispose();assert.equal(sourceDisposed,false);assert.ok(original.matrixWorld.equals(matrix));assert.ok(original.material.color.equals(colour));
 original.material.wireframe=true;assert.throws(()=>prepareHDScene(source,angle),/incarcare/);
}
assert.throws(()=>prepareHDScene(new THREE.Scene(),'front'),/pregatite/);
console.log('PASS: HD scene isolation, material/geometry ownership, nested and mirrored transforms, camera framing, UI exclusion and unloaded-model rejection.');

for(const corner of ['left','right'])for(const view of ['first','second','front','isometric']){
 const d=cameraExports.kitchenExportDirection(corner,view);assert(d.z>0);assert.equal(Math.sign(d.x),corner==='left'?1:-1);
}
assert.equal(cameraExports.kitchenExportCorner([{wall:'B'}]),'left');assert.equal(cameraExports.kitchenExportCorner([{wall:'C'}]),'right');
assert.equal(cameraExports.kitchenExportCorner([{wall:'B',placementMode:'free'}]),undefined);
for(const corner of ['left','right'])for(const angle of ['left','right','front']){
 const source=new THREE.Scene(),root=new THREE.Group();root.userData={exportGLB:true,asab:{asabType:'cabinet',wall:corner==='left'?'B':'C'}};source.add(root);root.add(new THREE.Mesh(new THREE.BoxGeometry(6,8,5),new THREE.MeshStandardMaterial()));
 const result=prepareHDScene(source,angle);assert.equal(Math.sign(result.camera.position.x),corner==='left'?1:-1);assert(result.camera.position.z>0);result.dispose();
}
console.log('PASS: every render angle and true isometric stays opposite the junction for both mirrored L kitchens.');
