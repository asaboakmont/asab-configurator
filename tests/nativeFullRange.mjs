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
const results=[], sourceWithoutFronts=[];
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
 if(p.collection==='japandi'&&p.type.startsWith('wall'))assert(!model.children.some(m=>m.userData.asab.category==='handle'),'Japandi push open '+p.sku);
 const ids=model.children.map(m=>m.geometry.uuid);
 applyNativeMaterials(model,{...colour,doorHex:'#334455'});
 assert.deepEqual(model.children.map(m=>m.geometry.uuid),ids);
 results.push({sku:p.sku,meshes,triangles});
 disposeNativeModel(model);scene.traverse(m=>{if(m.isMesh){m.geometry.dispose();(Array.isArray(m.material)?m.material:[m.material]).forEach(mat=>mat.dispose());}});
 if((i+1)%50===0)console.log(`${i+1}/335 parsed, built and verified`);
}
assert.equal(results.reduce((s,r)=>s+r.triangles,0),report.summary.triangles);
const summary={...report.summary,parsedAndBuilt:results.length,collections:[...new Set(rows.map(p=>p.collection))],allOriginalsUnchanged:true,sourceWithoutFronts};
if(process.env.ASAB_FULL_REPORT)fs.writeFileSync(process.env.ASAB_FULL_REPORT,JSON.stringify(summary,null,2)+'\n');
console.log('PASS:',JSON.stringify(summary));
