import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const root=process.env.ASAB_TEST_ROOT??path.resolve(import.meta.dirname,'..'),require=createRequire(path.join(root,'package.json')),ts=require('typescript'),T=require('three');
const cache=new Map();function load(n){if(cache.has(n))return cache.get(n);const m={exports:{}};cache.set(n,m.exports);new Function('require','exports','module',ts.transpileModule(fs.readFileSync(path.join(root,n.replace(/^@\//,'')+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(v=>v==='three'?T:v.startsWith('@/')?load(v):require(v),m.exports,m);return m.exports;}
const {automaticWorktopSpan,validateWorktopRun}=load('lib/asab/worktopRuns'),{calculateExportPricing}=load('lib/pricing/exportPricing');
const base={id:'base',sku:'1008-jpn',type:'base',wall:'A',width:200,height:86.2,depth:52.8,xPos:0,price:1000};
const filler={...base,id:'filler',type:'panel',width:10,depth:1.8,xPos:200,price:0,designPiece:{kind:'filler',band:'base'}};
assert.equal(automaticWorktopSpan([base,filler],'A').lengthCm,210);
const room={wallA:300,height:240};assert.equal(calculateExportPricing([base,filler],'linear',room).worktopPrice,740,'210 cm requires a full board');
assert.equal(calculateExportPricing([{...base,width:200},{...filler,width:5}],'linear',room).worktopPrice,370,'205 cm half board');
const left={...filler,xPos:0,width:5};assert.equal(automaticWorktopSpan([{...base,xPos:5},left],'A').startCm,0);
assert.equal(automaticWorktopSpan([base,{...filler,placementMode:'free'}],'A').lengthCm,200);
assert.equal(automaticWorktopSpan([base,{...filler,designPiece:{kind:'filler',band:'wall'}}],'A').lengthCm,200);
const custom={...base,runWorktopDimensions:{startCm:10,lengthCm:240}};
assert.equal(automaticWorktopSpan([custom,filler],'A').lengthCm,240);assert.equal(automaticWorktopSpan([custom,filler],'A').startCm,10);
assert.equal(automaticWorktopSpan([{...custom,runWorktopDimensions:undefined},filler],'A').lengthCm,210);
assert(validateWorktopRun(0,301,300));assert(validateWorktopRun(NaN,20,300));assert.equal(validateWorktopRun(0,300,300),undefined);
const {GLTFLoader}=await import(path.join(root,'node_modules/three/examples/jsm/loaders/GLTFLoader.js'));
const {cornerModelAnchor,bakeCabinetMeshGeometry,calibrateWallCornerGeometry}=load('lib/asab/cabinetModelGeometry');
let fronts=0;
for(const [collection,suffix]of [['japandi','jpn'],['germain','grm'],['franc','frc']])for(const side of ['STG','DR']){
 const b=fs.readFileSync(path.join(root,`public/${collection}/2001-${side}-${suffix}.glb`)),{scene}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const left=side==='STG',anchor=cornerModelAnchor(scene,left),sourceBounds=new T.Box3().setFromObject(scene).applyMatrix4(anchor),bounds=new T.Box3();
 scene.traverse(m=>{if(!m.isMesh)return;const source=Array.from(m.geometry.attributes.position.array),g=bakeCabinetMeshGeometry(m).applyMatrix4(anchor),old=g.clone();g.computeBoundingBox();const size=g.boundingBox.getSize(new T.Vector3());const hardware=/handle/i.test(m.material.name);
  calibrateWallCornerGeometry(g,sourceBounds.max.x,sourceBounds.max.z,left,hardware);bounds.union(g.boundingBox);
  if(hardware)assert(g.boundingBox.getSize(new T.Vector3()).distanceTo(size)<1e-6,'hardware stays rigid');
  else {const p=old.getAttribute('position'),q=g.getAttribute('position');for(let i=0;i<p.count;i++){
   if(Math.abs(p.getZ(i)-.288)<1e-5){assert(Math.abs(q.getZ(i)-.333)<1e-5);fronts++;}
   if(Math.abs(p.getX(i)-(left?sourceBounds.max.x-.288:.288))<1e-5)assert(Math.abs(q.getX(i)-(left?.667:.333))<1e-5);
  }}
  assert.deepEqual(Array.from(m.geometry.attributes.position.array),source);g.dispose();old.dispose();
 });
 assert(Math.abs(bounds.max.x-1)<1e-6);assert(Math.abs(bounds.max.z-.6)<1e-6);assert(bounds.min.x> -1e-6&&bounds.min.z> -1e-6);
}
assert(fronts>0);console.log('PASS: filler-driven spans, per-wall overrides/reset, stock thresholds; six real legacy corners align at 333mm with fixed footprints, unchanged source meshes and rigid handles.');
const editor=fs.readFileSync(path.join(root,'components/viewer/DesignPieceEditor.tsx'),'utf8');assert(editor.includes('${selected.freePosition?.x}-${selected.freePosition?.z}-${selected.rotationYDegrees}'));assert(editor.includes('Muta piesa ${label}'));console.log('PASS: free movement refreshes coordinate fields and exposes both room axes.');

const cRun={...base,wall:'C',width:250,runWorktopDimensions:{startCm:150,lengthCm:100}};
const separated=calculateExportPricing([{...base,runWorktopDimensions:{startCm:0,lengthCm:300}},cRun],'l-shape',{wallA:300,wallB:300,height:240,cornerSide:'left'});
assert.equal(separated.jointOverlapCm,0,'a run starting beyond the corner cannot receive a phantom joint deduction');
assert.equal(separated.worktopCuts.find(c=>c.run==='C').lengthCm,100);
console.log('PASS: repositioned worktop runs are priced without a fictitious corner overlap.');

assert.equal(automaticWorktopSpan([{...filler,wall:'B'}],'B').lengthCm,10,'an isolated filler is not a corner extension');

const {isPlinthSupport}=load('lib/asab/worktopRuns');
for (const wall of ['A','B','C']) {
 const run=[{...base,wall,xPos:10,width:60},{...filler,wall,xPos:70,width:8},
  {...filler,wall,xPos:5,width:5}].filter(isPlinthSupport);
 assert.equal(Math.min(...run.map(c=>c.xPos)),5,'leading filler extends plinth');
 assert.equal(Math.max(...run.map(c=>c.xPos+c.width)),78,'trailing filler extends plinth');
}
assert(isPlinthSupport({...filler,designPiece:{kind:'end-panel',band:'base'}}));
for(const band of ['wall','tall'])assert(!isPlinthSupport({...filler,designPiece:{kind:'filler',band}}));
assert(!isPlinthSupport({...filler,placementMode:'free'}));
assert(!isPlinthSupport({...filler,designPiece:{kind:'worktop',band:'base'}}));
assert(!isPlinthSupport({...base,type:'wall'}));assert(isPlinthSupport({...base,type:'tall'}));
assert.equal(automaticWorktopSpan([base,{...filler,runWorktopDimensions:{startCm:0,lengthCm:280}}],'A').lengthCm,280);
assert.equal(Math.max(...[base,filler].filter(isPlinthSupport).map(c=>c.xPos+c.width)),210,'manual top overhang does not extend the plinth');
const sceneSource=fs.readFileSync(path.join(root,'components/viewer/KitchenScene.tsx'),'utf8');
assert(sceneSource.includes('const runCabinets = cabinets.filter(isPlinthSupport)'));
console.log('PASS: plinth includes leading/trailing base fillers on A/B/C and base end panels; excludes free, wall/tall pieces and worktops.');
