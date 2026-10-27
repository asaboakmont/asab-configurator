import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..'),require=createRequire(path.join(root,'package.json')),ts=require('typescript'),T=require('three'),React=require('react'),cache=new Map();
function load(n){if(cache.has(n))return cache.get(n).exports;const m={exports:{}};cache.set(n,m);new Function('require','exports','module',ts.transpileModule(fs.readFileSync(path.join(root,n.replace(/^@\//,'')+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText)(v=>v==='three'?T:v.startsWith('@/')?load(v):require(v),m.exports,m);return m.exports;}
const runs=load('lib/asab/worktopRuns'),{calculateExportPricing}=load('lib/pricing/exportPricing');
const base={id:'base',sku:'test',type:'base',wall:'A',xPos:0,width:300,height:86.2,depth:52.8,price:1000};
const dims={startCm:10,lengthCm:240,depthCm:65,thicknessCm:4};
const custom={...base,runWorktopDimensions:dims},room={wallA:400,wallB:300,height:260};
const span=runs.automaticWorktopSpan([custom],'A');for(const k of Object.keys(dims))assert.equal(span[k],dims[k]);
assert.equal(runs.validateWorktopRun(10,240,400,65,4,300),undefined);
for(const args of [[0,240,400,0,4,300],[0,240,400,301,4,300],[0,240,400,65,0,300],[0,240,400,65,31,300],[0,240,400,65,NaN,300],[0,240,400,65,4,300,-1]])assert(runs.validateWorktopRun(...args));
let price=calculateExportPricing([custom],'linear',room);assert(price.worktopPricePending);assert.equal(price.worktopPrice,0);assert.equal(price.total,1000);assert.equal(price.worktopCuts[0].depthCm,65);assert.equal(price.worktopCuts[0].thicknessCm,4);
const priced={...custom,runWorktopDimensions:{...dims,manualPrice:900}};
price=calculateExportPricing([priced],'linear',room);assert(!price.worktopPricePending);assert.equal(price.total,1900);assert.equal(price.fullWorktops,0);
assert.equal(calculateExportPricing([{...priced,runWorktopDimensions:{...dims,manualPrice:0}}],'linear',room).total,1000);
assert.equal(calculateExportPricing([{...custom,runWorktopDimensions:{...dims,depthCm:55,thicknessCm:3.8,lengthCm:200}}],'linear',room).worktopPrice,370);
assert.equal(calculateExportPricing([{...base,runWorktopDimensions:undefined}],'linear',room).worktopPrice,740);
const corner=calculateExportPricing([{...base,runWorktopDimensions:{startCm:0,lengthCm:300,depthCm:75,thicknessCm:4,manualPrice:500}},{...base,id:'return',wall:'C',width:180,runWorktopDimensions:{startCm:0,lengthCm:180,depthCm:90,thicknessCm:4,manualPrice:600}}],'l-shape',{...room,wallA:300});
assert.equal(corner.jointOverlapCm,75);assert.equal(corner.worktopCuts.find(c=>c.run==='C').lengthCm,105);assert.equal(corner.worktopPrice,1100);
assert.deepEqual(JSON.parse(JSON.stringify(priced)).runWorktopDimensions,priced.runWorktopDimensions);
// Exercise the actual WorktopRun React output, including all wall orientations.
const text=fs.readFileSync(path.join(root,'components/viewer/KitchenScene.tsx'),'utf8'),ast=ts.createSourceFile('scene.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),fn=ast.statements.find(n=>n.name?.text==='WorktopRun');
const js=ts.transpileModule(fn.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React}}).outputText;
const fakeReact={createElement:React.createElement,Fragment:React.Fragment,useEffect:()=>{}},three={...T,TextureLoader:class{load(){return new T.Texture();}}};
const run=new Function('React','THREE','useMemo','automaticWorktopSpan','RULES','CM','WORKTOP_VISUAL_RAISE','WorktopBlock',js+';return WorktopRun;')(fakeReact,three,f=>f(),runs.automaticWorktopSpan,{BASE_HEIGHT:86.2},.1,.05,()=>null);
for(const wall of ['A','B','C','I','P']){
 const element=run({cabinets:[{...priced,wall}],colorway:{worktop:'stejar'},wallA:400});const blocks=element.props.children.filter(Boolean);assert.equal(blocks.length,1);
 const {size,position}=blocks[0].props;
 assert.deepEqual(size,wall==='A'||wall==='I'?[24,.4,6.5]:[6.5,.4,24]);
 assert(Math.abs(position[1]-(86.2+2)*.1-.05)<1e-9,'Thickness keeps the underside at the cabinet top');
 if(wall==='A')assert.equal(position[2],3.25);if(wall==='B')assert.equal(position[0],3.25);if(wall==='C')assert.equal(position[0],36.75);
}
const {createKitchenPDF}=load('lib/pdf/exportPDF');
const opts={enhancedPDF:true,cabinets:[priced],colorway:{name:'Alb mat',finish:'mat',doorHex:'#ffffff',worktopHex:'#cccccc',worktop:'stejar'},handle:'inox',totalPrice:0,layout:'linear',dimensions:room,collection:'japandi',includeCabinetTotal:true};
let doc=createKitchenPDF(opts),content=doc.internal.pages.flat().join('\n');assert(content.includes('2400 x 650 x 40'));assert(!content.includes('x 600 x 38'));
doc=createKitchenPDF({...opts,cabinets:[custom]});content=doc.internal.pages.flat().join('\n');assert(content.includes('TOTAL PARTIAL'));assert(content.includes('pret de confirmat'));
console.log('PASS: all worktop dimensions, validation/reset/persistence, standard and custom pricing, variable-depth corner joint, real React geometry A/B/C/I/P and PDF dimensions/partial totals.');
