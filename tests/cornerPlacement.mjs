import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const root=process.argv[2] ?? new URL('../',import.meta.url).pathname;
const require=createRequire(`${root}/package.json`), ts=require('typescript'), T=require('three');
const {GLTFLoader}=await import(`${root}/node_modules/three/examples/jsm/loaders/GLTFLoader.js`);
const code=ts.transpileModule(readFileSync(`${root}/lib/asab/cabinetModelGeometry.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const api={};new Function('require','exports',code)(()=>T,api);
let count=0;
for(const [collection,suffix] of [['japandi','jpn'],['germain','grm'],['franc','frc']]) for(const sku of ['1001-DR','1001-STG','2001-DR','2001-STG']){
 const bytes=readFileSync(`${root}/public/${collection}/${sku}-${suffix}.glb`);
 const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const anchor=api.cornerModelAnchor(scene,sku.endsWith('STG'));
 const bounds=new T.Box3();
 scene.traverse(m=>{if(!m.isMesh)return;const before=Array.from(m.geometry.attributes.position.array);const g=api.bakeCabinetMeshGeometry(m).applyMatrix4(anchor);g.computeBoundingBox();bounds.union(g.boundingBox);assert.deepEqual(Array.from(m.geometry.attributes.position.array),before);g.dispose();});
 assert.ok(bounds.min.length()<1e-5,`${sku} must use shared zero anchor`);
 assert.ok(bounds.max.x>.9 && bounds.max.x<1.01,`${sku} width must run along X`);
 for(const wall of ['B','C']){
  const base=sku.startsWith('1001'),off=base?.5:0,width=base?9.5:10;
  const rotation=wall==='B'?Math.PI/2:-Math.PI/2;
  const matrix=new T.Matrix4().makeTranslation(wall==='B'?off:40-off,0,wall==='B'?off+width:off).multiply(new T.Matrix4().makeRotationY(rotation)).multiply(new T.Matrix4().makeScale(10,10,10));
  const placed=bounds.clone().applyMatrix4(matrix);
  assert.ok(placed.min.x>=-1e-5 && placed.max.x<=40+1e-5 && placed.min.z>=-1e-5,`${collection}/${sku}/${wall} must be inside room: ${placed.min.toArray()}`);
  const face=new T.Vector3(0,0,1).transformDirection(new T.Matrix4().makeRotationY(rotation));
  assert.ok(wall==='B'?face.x>.99:face.x<-.99,'front must face room interior');count++;
 }
}
console.log(`PASS: ${count} real corner asset/wall placements preserve source geometry, normalize shared pivots and face inside room`);
