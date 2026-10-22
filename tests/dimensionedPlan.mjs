import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {jsPDF} from 'jspdf';
const api={};
new Function('exports',ts.transpileModule(fs.readFileSync(new URL('../lib/pdf/dimensionedPlan.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(api);
const {planFootprint,planSegments,addDimensionedTopPlan}=api;
const base={sku:'1008',type:'base',wall:'A',width:60,height:86,depth:53,xPos:0,price:350};
assert.deepEqual(planFootprint(base,300),{minX:0,maxX:60,minZ:5,maxZ:58});
const left=planFootprint({...base,wall:'B',xPos:80},300),right=planFootprint({...base,wall:'C',xPos:80},300);
assert.equal(left.minZ,80);assert.equal(right.minZ,80);assert.equal(left.minX,300-right.maxX);assert.equal(left.maxX,300-right.minX);
assert.deepEqual(planFootprint({...base,placementMode:'free',freePosition:{x:120,z:150},rotationYDegrees:90},300),{minX:93.5,maxX:146.5,minZ:120,maxZ:180});
const segments=planSegments([{...base,xPos:10},{...base,xPos:80}], 'A',200,false);
assert.deepEqual(segments.map(s=>[s.start,s.end,s.gap]),[[0,10,true],[10,70,false],[70,80,true],[80,140,false],[140,200,true]]);
assert.equal(planSegments([{...base,type:'wall'}],'A',200,false).length,0);
const defaults={enhancedPDF:true,cabinets:[],colorway:{name:'Alb mat'},handle:'inox',totalPrice:0,layout:'linear',dimensions:{wallA:300,height:250}};
const disabled=new jsPDF();addDimensionedTopPlan(disabled,{...defaults,enhancedPDF:false});assert.equal(disabled.getNumberOfPages(),1);
const cases=[
 {...defaults,cabinets:[...Array.from({length:5},(_,i)=>({...base,xPos:i*60})),...Array.from({length:5},(_,i)=>({...base,type:'wall',height:72,depth:32,xPos:i*60}))]},
 ...['left','right'].map(side=>({...defaults,layout:'l-shape',dimensions:{wallA:400,wallB:300,height:250,cornerSide:side},cabinets:[...Array.from({length:5},(_,i)=>({...base,xPos:i*60})),...[false,true].flatMap(wall=>Array.from({length:3},(_,i)=>({...base,wall:side==='left'?'B':'C',type:wall?'wall':'base',depth:wall?32:53,xPos:95+i*60})))]})),
 {...defaults,layout:'island',dimensions:{wallA:400,wallB:350,height:250,hasIsland:true},cabinets:[...Array.from({length:5},(_,i)=>({...base,xPos:i*60})),...Array.from({length:3},(_,i)=>({...base,wall:'I',xPos:90+i*60,zPos:180}))]}
];
const doc=new jsPDF();for(const opts of cases)addDimensionedTopPlan(doc,opts);doc.deletePage(1);
const text=doc.internal.pages.flat().join(' ');assert(text.includes('Camera A: 4000'));assert(text.includes('3000 camera'));assert(text.includes('2200* camera'));assert(text.includes('neconfirmata'));assert(!text.includes('arc('));
if(process.env.ASAB_TOP_PLAN_SAMPLE)fs.writeFileSync(process.env.ASAB_TOP_PLAN_SAMPLE,Buffer.from(doc.output('arraybuffer')));
console.log('PASS: mirrored footprints, free rotations, exact width/gap chains, separate wall layers, internal-only top plans and explicit default room depth.');
