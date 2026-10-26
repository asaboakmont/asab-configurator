import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=process.env.ASAB_TEST_ROOT??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'package.json')),ts=require('typescript'),cache=new Map();
const THREE=await import(pathToFileURL(path.join(root,'node_modules/three/build/three.module.js')));
const { GLTFLoader }=await import(pathToFileURL(path.join(root,'node_modules/three/examples/jsm/loaders/GLTFLoader.js')));
function load(name){
 const file=path.join(root,name.slice(2)+'.ts');if(cache.has(file))return cache.get(file).exports;
 const m={exports:{}};cache.set(file,m);
 new Function('require','exports','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText)(n=>n==='three'?THREE:n.startsWith('@/')?load(n):require(n),m.exports,m);return m.exports;
}
const { cabinetBottomCm, cabinetVerticalRange, cabinetWallGapCm, legacyWallCornerSku, minimumRoomHeightCm }=load('@/lib/asab/cabinetPlacement');
const { nativeProduct, nativeDimensions }=load('@/lib/catalog/nativeCatalogue');
const { nativeAssetUrl }=load('@/lib/catalog/modelAssets');
const { buildNativeModel, applyNativeMaterials, disposeNativeModel }=load('@/lib/asab/nativeModelGeometry');
const colour={doorHex:'#eeeedd',carcassHex:'#ffffff',handleHex:'#222222',finish:'mat'};
async function scene(product){const b=fs.readFileSync(path.join(root,'public',nativeAssetUrl(product.modelUrl)));return (await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'')).scene;}
const near=(a,b)=>assert(Math.abs(a-b)<1e-3,`${a} != ${b}`);
const bound=o=>{o.updateMatrixWorld(true);return new THREE.Box3().setFromObject(o);};
for(const collection of ['smart','japandi','germain','franc']){
 const hood=nativeProduct('2007',60,collection),donor=nativeProduct('2010',60,collection);
 const source=await scene(hood),front=await scene(donor);source.updateMatrixWorld(true);front.updateMatrixWorld(true);
 const snapshot=JSON.stringify(source.toJSON()),donorSnapshot=JSON.stringify(front.toJSON());
 for(const direction of ['S','D']){
  const options={width:60,depth:nativeDimensions(hood).depth,doorDirection:direction};
  const open=buildNativeModel(source,hood,options,colour),fixed=buildNativeModel(source,hood,options,colour,undefined,front);
  const doors=fixed.children.filter(m=>m.userData.asab.category==='front');assert(doors.length);
  const frontBox=bound(doors[0]);near(frontBox.max.y-frontBox.min.y,6.57);near(frontBox.max.x-frontBox.min.x,5.97);
  assert(fixed.children.some(m=>m.userData.asab.category==='hardware'));
  assert.equal(fixed.children.some(m=>m.userData.asab.category==='handle'),collection!=='japandi');
  // All five source carcass pieces remain byte-for-byte identical; no generic replacement box.
  if(direction==='S') for(const before of open.children){const after=fixed.children.find(m=>m.name===before.name);assert(after);assert.deepEqual(after.geometry.attributes.position.array,before.geometry.attributes.position.array);}
  const oldIds=fixed.children.map(m=>m.geometry.uuid);applyNativeMaterials(fixed,{...colour,doorHex:'#884444'});assert.deepEqual(fixed.children.map(m=>m.geometry.uuid),oldIds);
  disposeNativeModel(open);disposeNativeModel(fixed);
 }
 assert.equal(JSON.stringify(source.toJSON()),snapshot);assert.equal(JSON.stringify(front.toJSON()),donorSnapshot);
 const wall={sku:donor.sku,type:'wall',height:70};near(cabinetBottomCm(wall),150);near(cabinetVerticalRange(wall)[1],220);
 const hoodCab={sku:hood.sku,type:'wall-hood',height:66};near(cabinetBottomCm(hoodCab),154);near(cabinetVerticalRange(hoodCab)[1],220);
 for(const sku of ['ASAB-SP-1U-W0600','ASAB-SP-2F-PIST-W0800']){
  const sp=nativeProduct(sku,sku.endsWith('W0800')?80:60,collection);near(sp.mountHeightCm,220);
  const cab={sku:sp.sku,type:'wall',height:40,mountHeightCm:216.9};assert.deepEqual(cabinetVerticalRange(cab),[220,260]);
 }
 const tall=nativeProduct('1011A',60,collection),tallSource=await scene(tall);tallSource.updateMatrixWorld(true);
 const cab={sku:tall.sku,type:'tall',width:60,...nativeDimensions(tall)};near(cab.height,220);near(cabinetWallGapCm(cab),0);
 const model=buildNativeModel(tallSource,tall,cab,colour);
 for(const wallId of ['A','B','C']){
  const center=cab.depth/2+cabinetWallGapCm(cab),group=new THREE.Group();group.add(model);group.position.set((wallId==='B'?center:wallId==='C'?400-center:90)/10,cab.height/20,(wallId==='A'?center:90)/10);group.rotation.y=wallId==='B'?Math.PI/2:wallId==='C'?-Math.PI/2:0;
  const box=bound(group);near(wallId==='A'?box.min.z:wallId==='B'?box.min.x:40-box.max.x,0);near(box.min.y,0);near(box.max.y,22);group.remove(model);
 }
 disposeNativeModel(model);
 for(const side of ['STG','DR'])assert.equal(legacyWallCornerSku({sku:`ASAB-CS-COLT-${side}-W1000`,type:'wall-corner',cornerSide:side}),`2001-${side}`);
}
// Actual runtime wiring is part of the contract: fallback corners and hood donor must reach the viewer.
const nativeSource=fs.readFileSync(path.join(root,'components/viewer/NativeCabinetModel.tsx'),'utf8');assert(nativeSource.includes('accessory, hood)'));assert(nativeSource.includes('hoodFrontUrl ? load(hoodFrontUrl)'));
const sceneSource=fs.readFileSync(path.join(root,'components/viewer/KitchenScene.tsx'),'utf8');assert(sceneSource.includes('!internalPreview || legacyCorner ? undefined : nativeModel'));assert(sceneSource.includes('cabinetWallGapCm(cabinet)'));
console.log('PASS: all four hood fronts/hardware, handing, original carcasses, colour edits; CS/CA top 2200mm, SP bottom 2200mm including old saves; tall flush on A/B/C; legacy wall-corner routing.');

assert.equal(minimumRoomHeightCm([{sku:'ASAB-SP-1U-W0600-JPN',type:'wall',height:40,mountHeightCm:216.9}]),260);
assert.equal(minimumRoomHeightCm([{sku:'ASAB-CA-CPT-W0600-JPN',type:'tall-oven',height:220}]),220);
console.log('PASS: internal room-height changes respect existing tall and SP cabinets');
