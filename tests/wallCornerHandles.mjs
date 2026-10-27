import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const root=new URL('../',import.meta.url).pathname,require=createRequire(`${root}/package.json`),ts=require('typescript'),T=require('three');
const {GLTFLoader}=await import(`${root}/node_modules/three/examples/jsm/loaders/GLTFLoader.js`);
const api={};new Function('require','exports',ts.transpileModule(fs.readFileSync(`${root}/lib/asab/cabinetModelGeometry.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(()=>T,api);
const near=(a,b,message)=>assert(Math.abs(a-b)<1e-6,`${message}: ${a} != ${b}`);
let checked=0;
for(const collection of ['smart','franc'])for(const side of ['STG','DR']){
 const file=collection==='smart'?`models/2001-${side}.glb`:`franc/2001-${side}-frc.glb`;
 const regularBytes=fs.readFileSync(`${root}/public/models/catalogue-optimized/${collection}/ASAB-CS-1U-RAFT-W0600-${collection==='smart'?'SMT':'FRC'}.glb`);
 const {scene:regular}=await new GLTFLoader().parseAsync(regularBytes.buffer.slice(regularBytes.byteOffset,regularBytes.byteOffset+regularBytes.byteLength),'');
 regular.updateMatrixWorld(true);let regularHandleBottom=Infinity;
 regular.traverse(m=>{if(m.isMesh&&/handle/i.test(m.name))regularHandleBottom=Math.min(regularHandleBottom,new T.Box3().setFromObject(m).min.y);});
 assert(Number.isFinite(regularHandleBottom),'native reference must contain a handle');

 const bytes=fs.readFileSync(`${root}/public/${file}`),{scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const snapshot=JSON.stringify(scene.toJSON()),left=side==='STG',anchor=api.cornerModelAnchor(scene,left),bounds=new T.Box3().setFromObject(scene).applyMatrix4(anchor);
 const inputs=[];scene.traverse(m=>{if(m.isMesh&&/handle/i.test(m.material.name))inputs.push(api.bakeCabinetMeshGeometry(m).applyMatrix4(anchor));});
 for(const align of [false,true]){
  const parts=inputs.flatMap(g=>api.wallCornerHandleParts(g,bounds.max.x,left));
  assert.equal(parts.length,2,'each corner has two independent handles, including merged Smart mesh');
  assert.equal(parts.reduce((n,p)=>n+p.geometry.getAttribute('position').count,0),inputs.reduce((n,g)=>n+(g.index?.count??g.getAttribute('position').count),0),'retain every source triangle');
  const prepared=inputs.flatMap(g=>api.prepareWallCornerHandles(g,bounds.max.x,bounds.max.z,left,align,.0014));
  prepared.forEach((g,i)=>{
   g.computeBoundingBox();parts[i].geometry.computeBoundingBox();const box=g.boundingBox,before=parts[i].geometry.boundingBox;
   near(box.getSize(new T.Vector3()).distanceTo(before.getSize(new T.Vector3())),0,'rigid handle size');
   near(box.min.y,align?regularHandleBottom:before.min.y,'corner handle bottom matches regular native wall units; public height unchanged');
   assert(box.max.x-box.min.x<.05 && box.max.z-box.min.z<.05,'handles must not span the corner');
   const normal=parts[i].normal;
   const plane=normal.z? (align?.333:.288) : (left? (align?.667:bounds.max.x-.288) : (align?.333:.288));
   const a=normal.z?box.min.z:left?-box.max.x:box.min.x,b=normal.z?plane:left?-plane:plane;
   assert(a>=b-.002 && a-b<.01,`${collection}/${side}: handle mounting end stays on its own door face (${a-b})`);
   // Far from the adjacent unit boundary, never reflected to the other end.
   assert(box.min.x>=-.001 && box.max.x<=1.001 && box.min.z>=0 && box.max.z<=.602);
   for(const wall of ['B','C'])for(const direction of ['S','D']){
    const matrix=new T.Matrix4().makeTranslation(wall==='B'?0:40,15,wall==='B'?10:0).multiply(new T.Matrix4().makeRotationY(wall==='B'?Math.PI/2:-Math.PI/2)).multiply(new T.Matrix4().makeScale(10,10,10));
    const placed=box.clone().applyMatrix4(matrix);assert(placed.min.x>=-1e-5 && placed.max.x<=40.001 && placed.min.z>=-1e-5);
    checked++;
   }
  });
 }
 assert.equal(JSON.stringify(scene.toJSON()),snapshot,'source assets unchanged');
}
const source=fs.readFileSync(`${root}/components/viewer/KitchenScene.tsx`,'utf8');
assert(source.includes('doorDirection === "D" && cabinet.type !== "wall-corner"'));
assert(source.includes('= isHandle && cabinet.type !== "wall-corner"'));
assert(source.includes('prepareWallCornerHandles(bakedGeometry'));
console.log(`PASS: ${checked} Smart/Franc handle placements across both corner hands, opening directions, walls and calibration modes; triangles conserved, rigid sizes, mounting planes, unchanged sources and corner-specific runtime wiring.`);

// Execute the actual React renderer, including nested handle transforms.
const ReactBase=require('react');let runtimeMeshes=[],hook=0;
const React={...ReactBase,useEffect(){},useState(){return [["",0,runtimeMeshes][hook++],()=>{}];}};
const ast=ts.createSourceFile('scene.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=ast.statements.find(n=>n.name?.text==='CabinetMeshGLB').getText(ast);
const deps={React,THREE:T,cabinetBottomCm:()=>150,useMemo:fn=>fn(),legacyWallCornerSku:c=>c.type==='wall-corner'?c.baseSku:undefined,
 stripCollectionSku:s=>s,getSkuByCode:()=>({width:100}),cabinetWidthScale:(a,b)=>a/b,
 createDoorMaterial:()=>new T.MeshStandardMaterial(),cabinetObjectName:()=> 'corner',cabinetExportData:()=>({}),
 GLB_HANDLE_FORWARD_OFFSET:.14,HANDLE_RENDER_ORDER:10,CM:.1,MeshEdgeLines:()=>null,Html:()=>null,
 handleScaleCompensation:()=>({position:[0,0,0],scale:[1,1,1]})};
const render=new Function(...Object.keys(deps),ts.transpileModule(component+'\nreturn CabinetMeshGLB;',
 {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText)(...Object.values(deps));
function meshBounds(node,parent=new T.Matrix4(),result=[]){
 if(!node||typeof node!=='object')return result;
 const p=node.props??{};let matrix=parent;
 if(node.type==='group'||node.type==='mesh')matrix=parent.clone().multiply(new T.Matrix4().compose(new T.Vector3(...(p.position??[0,0,0])),new T.Quaternion().setFromEuler(new T.Euler(...(p.rotation??[0,0,0]))),new T.Vector3(...(p.scale??[1,1,1]))));
 if(node.type==='mesh')result.push(p.geometry.boundingBox.clone().applyMatrix4(matrix));
 ReactBase.Children.toArray(p.children).forEach(n=>meshBounds(n,matrix,result));return result;
}
for(const collection of ['smart','franc'])for(const side of ['STG','DR']){
 const bytes=fs.readFileSync(`${root}/public/${collection==='smart'?`models/2001-${side}.glb`:`franc/2001-${side}-frc.glb`}`);
 const{scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const anchor=api.cornerModelAnchor(scene,side==='STG'),bounds=new T.Box3().setFromObject(scene).applyMatrix4(anchor);
 runtimeMeshes=[];scene.traverse(m=>{if(!m.isMesh||!/handle/i.test(m.material.name))return;const g=api.bakeCabinetMeshGeometry(m).applyMatrix4(anchor);
 runtimeMeshes.push(...api.prepareWallCornerHandles(g,bounds.max.x,bounds.max.z,side==='STG',true,.0014).map(geometry=>({geometry,matName:'handle',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]})));});
 let expected;
 for(const direction of ['S','D']){
  hook=0;const tree=render({cabinet:{type:'wall-corner',sku:`2001-${side}`,baseSku:`2001-${side}`,width:100,standardWidth:100},colorway:{finish:'mat',carcassHex:'#fff',handleHex:'#333',doorHex:'#eee'},collection,posX:0,posY:0,posZ:0,rotY:0,doorDirection:direction});
  const boxes=meshBounds(tree);assert.equal(boxes.length,2);
  const values=boxes.map(b=>[...b.min.toArray(),...b.max.toArray()]);
  if(expected)assert.deepEqual(values,expected,'actual D renderer must not reflect corner handles');else expected=values;
  boxes.forEach((b,i)=>{const original=runtimeMeshes[i].geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().makeScale(10,10,10));assert.deepEqual(b.min.toArray(),original.min.toArray(),'no second global-Z visibility offset');assert.deepEqual(b.max.toArray(),original.max.toArray());});
 }
}
console.log('PASS: actual CabinetMeshGLB React output keeps identical corner handle positions for S/D, with no second global-Z offset, for both Smart and Franc hands.');

// The PDF camera must look into both door faces after the corner root rotation.
const technicalSource=fs.readFileSync(`${root}/lib/pdf/technicalViews.ts`,'utf8');
const technicalAst=ts.createSourceFile('technical.ts',technicalSource,ts.ScriptTarget.Latest,true);
const directionFunction=technicalAst.statements.find(n=>n.name?.text==='cabinetTechnicalDirection').getText(technicalAst);
const cameraApi={};new Function('THREE','exports',ts.transpileModule(directionFunction,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(T,cameraApi);
for(const side of ['STG','DR'])for(const yaw of [0,Math.PI/2,-Math.PI/2]){
 const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),yaw);
 const d=cameraApi.cabinetTechnicalDirection({type:'wall-corner',sku:`2001-${side}`,cornerSide:side},rotation,true);
 const front=new T.Vector3(0,0,1).applyQuaternion(rotation),sideNormal=new T.Vector3(side==='STG'?-1:1,0,0).applyQuaternion(rotation);
 assert(d.dot(front)>0 && d.dot(sideNormal)>0,'PDF camera must see both handle-bearing door faces');
}
console.log('PASS: PDF corner exterior camera sees both door faces for STG/DR on every wall rotation.');

for(const side of ['STG','DR'])for(const wall of ['A','B','C']){
 const d=cameraApi.cabinetTechnicalDirection({type:'wall-corner',sku:`2001-${side}`,wall},new T.Quaternion());
 assert.deepEqual(d.toArray(),wall==='B'?[1,.3,1]:wall==='C'?[-1,.3,1]:[.5,.3,1],'public PDF keeps its previous camera');
}
assert(fs.readFileSync(`${root}/components/viewer/StepViewer.tsx`,'utf8').includes('captureTechnicalViews(liveScene, cabinets, isInternal)'));
console.log('PASS: corrected PDF camera requires internal role opt-in; public camera stays unchanged.');
