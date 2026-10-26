import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.ASAB_TEST_ROOT??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'package.json')),ts=require('typescript');
const THREE=await import(pathToFileURL(path.join(root,'node_modules/three/build/three.module.js')));
const {GLTFLoader}=await import(pathToFileURL(path.join(root,'node_modules/three/examples/jsm/loaders/GLTFLoader.js')));
function api(file){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(()=>THREE,exports);return exports;}
const {buildNativeModel,applyNativeMaterials,disposeNativeModel}=api(path.join(root,'lib/asab/nativeModelGeometry.ts'));
const rows=JSON.parse(fs.readFileSync(path.join(root,'data/nativeCatalogue.json'),'utf8'));
const report=JSON.parse(fs.readFileSync(path.join(root,'public/models/catalogue-pilot/japandi/pilot-report.json'),'utf8'));
async function parse(file){const b=fs.readFileSync(file);const {scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');scene.updateMatrixWorld(true);return scene;}
function digest(scene){
 const hash=createHash('sha256');let triangles=0,meshes=0;const v=new THREE.Vector3(),values=[];
 scene.updateMatrixWorld(true);scene.traverse(mesh=>{
  if(!mesh.isMesh)return;meshes++;const pos=mesh.geometry.attributes.position,idx=mesh.geometry.index;
  for(let i=0;i<(idx?.count??pos.count);i++){
   v.fromBufferAttribute(pos,idx?idx.getX(i):i).applyMatrix4(mesh.matrixWorld);
   values.push(Math.round(v.x*1e5),Math.round(v.y*1e5),Math.round(v.z*1e5));
  }
  triangles+=(idx?.count??pos.count)/3;
 });hash.update(Buffer.from(new Int32Array(values).buffer));
 return {hash:hash.digest('hex'),triangles,meshes};
}
const colour={doorHex:'#F2F0EC',carcassHex:'#F5F4F0',handleHex:'#C0C0C0',finish:'mat'};
const benchmarks=[];
for(const row of report){
 const p=rows.find(p=>p.sku===row.sku),cab={width:60,depth:(p.bodyDepthMm+18)/10};
 const raw=path.join(root,'public/models/catalogue/japandi',row.sku+'.glb'),merged=path.join(root,'public/models/catalogue-pilot/japandi',row.sku+'.glb');
 assert.equal(createHash('sha256').update(fs.readFileSync(raw)).digest('hex'),row.sourceSha256,'original asset untouched');
 const a=await parse(raw),b=await parse(merged);const da=digest(a),db=digest(b);
 assert.equal(da.hash,db.hash,'every world-space triangle is unchanged');assert.equal(da.triangles,db.triangles);assert.equal(db.meshes,row.pilotPrimitives);
 const product={...p};const original=buildNativeModel(a,product,cab,colour),pilot=buildNativeModel(b,product,cab,colour);
 assert.equal(digest(original).hash,digest(pilot).hash,'renderer preserves identical standard-width geometry');
 if(p.type==='wall'){
  const drainer=await parse(path.join(root,'public/models/catalogue/common/ASAB-ACC-SCURG-W0600-COM.glb'));
  const settings={...cab,drainerSku:'ASAB-ACC-SCURG-W0600-COM'};
  const originalInside=buildNativeModel(a,product,settings,colour,drainer),pilotInside=buildNativeModel(b,product,settings,colour,drainer);
  assert.equal(digest(originalInside).hash,digest(pilotInside).hash,'drainer placement is identical');
  assert(!pilotInside.children.some(m=>/^Shelf/.test(m.name)));
  assert(pilotInside.children.some(m=>m.userData.asab.category==='drainer'));
  const inside=new THREE.Box3();pilotInside.children.filter(m=>m.userData.asab.category==='drainer').forEach(m=>inside.union(new THREE.Box3().setFromObject(m)));
  assert(inside.min.x>=-2.821&&inside.max.x<=2.821&&inside.min.y>-3.32&&inside.max.y<3.32);
  disposeNativeModel(originalInside);disposeNativeModel(pilotInside);
 }
 const meshes=pilot.children.filter(m=>m.isMesh),ids=meshes.map(m=>m.geometry.uuid),arrays=meshes.map(m=>m.geometry.attributes.position.array.slice());
 const normals=meshes.map(m=>m.geometry.attributes.normal.array.slice());
 const colours=[];for(let i=0;i<30;i++){const start=performance.now();applyNativeMaterials(pilot,{...colour,doorHex:i%2?'#884422':'#226688'});colours.push(performance.now()-start);}
 assert.deepEqual(meshes.map(m=>m.geometry.uuid),ids);meshes.forEach((m,i)=>{assert.deepEqual(m.geometry.attributes.position.array,arrays[i]);assert.deepEqual(m.geometry.attributes.normal.array,normals[i]);});
 const front=meshes.find(m=>m.userData.asab.category==='front');assert(front.material.color.equals(new THREE.Color('#884422')));
 for(const width of [45,72])for(const direction of ['S','D']){
  const model=buildNativeModel(b,product,{...cab,width,doorDirection:direction},colour),box=new THREE.Box3().setFromObject(model);
  assert(Math.abs(box.getSize(new THREE.Vector3()).x-width*.1)<.001);
  assert(Math.abs(box.getSize(new THREE.Vector3()).y-new THREE.Box3().setFromObject(pilot).getSize(new THREE.Vector3()).y)<.001);
  const handles=model.children.filter(m=>m.userData.asab.category==='handle');
  if(handles.length){const h=new THREE.Box3();handles.forEach(m=>h.union(new THREE.Box3().setFromObject(m)));const originalH=new THREE.Box3();pilot.children.filter(m=>m.userData.asab.category==='handle').forEach(m=>originalH.union(new THREE.Box3().setFromObject(m)));assert(Math.abs(h.getSize(new THREE.Vector3()).x-originalH.getSize(new THREE.Vector3()).x)<.001,'handle width retained');}
  disposeNativeModel(model);
 }
 const timesA=[],timesB=[];
 for(let i=0;i<7;i++)for(const [source,times]of[[a,timesA],[b,timesB]]){const start=performance.now();const model=buildNativeModel(source,product,cab,colour);times.push(performance.now()-start);disposeNativeModel(model);}
 const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
 benchmarks.push({sku:p.sku,originalMeshes:da.meshes,pilotMeshes:db.meshes,triangles:db.triangles,originalBuildMedianMs:median(timesA),pilotBuildMedianMs:median(timesB),materialUpdateMedianMs:median(colours),colourGeometryRebuilds:0});
 disposeNativeModel(original);disposeNativeModel(pilot);
}
// Assert the actual React geometry effect cannot depend on any colour/worktop value.
const ast=ts.createSourceFile('Native.tsx',fs.readFileSync(path.join(root,'components/viewer/NativeCabinetModel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let found=false;function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useEffect'&&n.arguments[0]?.getText(ast).includes('buildNativeModel')){found=true;const deps=n.arguments[1].getText(ast);assert(!/colorway|doorHex|carcassHex|handleHex|finish|worktop/.test(deps));}ts.forEachChild(n,visit);}visit(ast);assert(found);
console.log(JSON.stringify(benchmarks,null,2));
if(process.env.ASAB_PILOT_REPORT)fs.writeFileSync(process.env.ASAB_PILOT_REPORT,JSON.stringify(benchmarks,null,2)+'\n');
console.log('PASS: lossless part/material merging, unchanged source assets, exact world triangles, source pivots, handedness, custom widths, handle size, material-only edits and React geometry dependencies.');
