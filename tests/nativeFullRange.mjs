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
function api(file){const exports={};new Function('require','exports',ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(()=>THREE,exports);return exports;}
const {nativeAssetUrl}=api('lib/catalog/modelAssets.ts');
const {buildNativeModel,applyNativeMaterials,disposeNativeModel}=api('lib/asab/nativeModelGeometry.ts');
const rows=JSON.parse(fs.readFileSync(path.join(root,'data/nativeCatalogue.json'),'utf8'));
const report=JSON.parse(fs.readFileSync(path.join(root,'public/models/catalogue-optimized/optimization-report.json'),'utf8'));
assert.equal(report.models.length,335);assert.equal(rows.length,335);
const colour={doorHex:'#F2F0EC',carcassHex:'#F5F4F0',handleHex:'#C0C0C0',finish:'mat'};
const results=[], sourceWithoutFronts=[], fixedCornerFinishes=[];
for(const [i,p]of rows.entries()){
 const record=report.models.find(r=>r.sku===p.sku);assert(record?.validated,p.sku);
 const original=path.join(root,'public',p.modelUrl),optimized=path.join(root,'public',nativeAssetUrl(p.modelUrl));
 assert.equal(nativeAssetUrl(p.modelUrl,true),p.modelUrl);
 assert.equal(nativeAssetUrl(p.modelUrl),record.modelUrl);
 const originalBytes=fs.readFileSync(original);
 assert.equal(createHash('sha256').update(originalBytes).digest('hex'),record.sourceSha256,'original unchanged');
 const sourceDoc=JSON.parse(originalBytes.subarray(20,20+originalBytes.readUInt32LE(12)).toString());
 const sourceHasFront=sourceDoc.nodes.some(n=>/^(Door|DrawerFront)/.test(n.name??''));
 const bytes=fs.readFileSync(optimized);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),record.optimizedSha256);
 const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');scene.updateMatrixWorld(true);
 let triangles=0,meshes=0;
 scene.traverse(m=>{if(!m.isMesh)return;meshes++;triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});
 assert.equal(triangles,record.triangles,p.sku);assert.equal(meshes,record.optimizedPrimitives,p.sku);
 const depth=(p.bodyDepthMm+(p.type==='accessory'?0:18))/10;
 const model=buildNativeModel(scene,p,{width:p.widthMm/10,depth},colour);
 const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
 const expected=(p.sku.startsWith('ASAB-ACC-SCURG-')?p.widthMm-36:p.widthMm)/100;
 assert(Math.abs(size.x-expected)<.002,`${p.sku} width: ${size.x} vs ${expected}`);
 assert([size.x,size.y,size.z,box.min.x,box.min.y,box.min.z].every(Number.isFinite));
 if(p.type!=='accessory'){
  if(sourceHasFront) assert(model.children.some(m=>m.userData.asab.category==='front'),p.sku+' fronts');
  else sourceWithoutFronts.push(p.sku);
  assert(model.children.some(m=>m.userData.asab.category==='carcass'),p.sku+' carcass');
 }
 if(p.baseSku.startsWith('ASAB-SP-')||(p.collection==='germain'&&p.type.startsWith('wall')))assert(!model.children.some(m=>m.userData.asab.category==='handle'),'Handleless SP/Germain wall '+p.sku);
 if(p.collection==='japandi'&&p.type.startsWith('wall'))assert(!model.children.some(m=>m.userData.asab.category==='handle'),'Japandi push open '+p.sku);
 const fixedPanels=model.children.filter(m=>/corner.*fixed.*panel/i.test(m.name));
 if(p.type==='base-corner'){
  assert.equal(fixedPanels.length,2,'Both fixed corner facings must remain: '+p.sku);
  for(const panel of fixedPanels){
   assert.equal(panel.userData.asab.category,'carcass','Fixed facings must survive doorless exports');
   for(const material of Array.isArray(panel.material)?panel.material:[panel.material]){
    assert(material.color.equals(new THREE.Color(colour.doorHex)),p.sku+' fixed facing initial door finish');
    assert.equal(material.roughness,.65);
   }
  }
  fixedCornerFinishes.push(p.sku);
 }
 const panelPositions=fixedPanels.map(m=>m.geometry.attributes.position.array.slice());
 const ids=model.children.map(m=>m.geometry.uuid);
 applyNativeMaterials(model,{...colour,doorHex:'#334455'});
 assert.deepEqual(model.children.map(m=>m.geometry.uuid),ids);
 // Colour edits must affect fixed facings without rebuilding or moving them.
 for(const [j,panel]of fixedPanels.entries()){
  assert.deepEqual(panel.geometry.attributes.position.array,panelPositions[j]);
  for(const material of Array.isArray(panel.material)?panel.material:[panel.material])assert(material.color.equals(new THREE.Color('#334455')),p.sku+' fixed facing follows colour changes');
 }
 for(const body of model.children.filter(m=>m.userData.asab.category==='carcass'&&!fixedPanels.includes(m)))
  for(const material of Array.isArray(body.material)?body.material:[body.material])assert(material.color.equals(new THREE.Color(colour.carcassHex)),p.sku+' actual carcass keeps its own finish');
 applyNativeMaterials(model,{...colour,doorHex:'#112233',finish:'lucios'});
 for(const panel of fixedPanels)for(const material of Array.isArray(panel.material)?panel.material:[panel.material]){
  assert(material.color.equals(new THREE.Color('#112233')));assert.equal(material.roughness,.2,'Fixed facing follows glossy door finish');
 }

 results.push({sku:p.sku,meshes,triangles});
 disposeNativeModel(model);scene.traverse(m=>{if(m.isMesh){m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>mat.dispose());}});
 if((i+1)%50===0)console.log(`${i+1}/335 parsed, built and verified`);
}
assert.equal(results.reduce((s,r)=>s+r.triangles,0),report.summary.triangles);
assert.equal(fixedCornerFinishes.length,rows.filter(p=>p.type==='base-corner').length);
assert.deepEqual([...new Set(fixedCornerFinishes.map(s=>s.slice(-3)))].sort(),['FRC','GRM','JPN','SMT']);
console.log('PASS: fixed corner facings follow matte/glossy door colours, stay fixed for interior views, preserve geometry and leave actual carcasses unchanged across',fixedCornerFinishes.length,'corner cabinets.');
const summary={...report.summary,parsedAndBuilt:results.length,collections:[...new Set(rows.map(p=>p.collection))],allOriginalsUnchanged:true,sourceWithoutFronts};
if(process.env.ASAB_FULL_REPORT)fs.writeFileSync(process.env.ASAB_FULL_REPORT,JSON.stringify(summary,null,2)+'\n');
console.log('PASS:',JSON.stringify(summary));
