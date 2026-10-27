import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.env.ASAB_TEST_ROOT??path.resolve(import.meta.dirname,'..');
const require=createRequire(path.join(root,'package.json')),ts=require('typescript'),cache=new Map();
function load(rel){const file=path.join(root,rel.replace(/^@\//,'')+'.ts');if(cache.has(file))return cache.get(file);const m={exports:{}};cache.set(file,m.exports);new Function('require','exports','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText)(n=>n.startsWith('@/')?load(n):require(n),m.exports,m);return m.exports;}
const d=load('lib/asab/designPieces'),p=load('lib/pricing/exportPricing'),placement=load('lib/asab/cabinetPlacement');
const room={wallA:400,wallB:300,height:280};
for(const band of ['base','wall','tall'])for(const kind of ['filler','end-panel','worktop']){
 const item=d.priceDesignPiece(d.createDesignPiece(kind,band,'A',`${band}-${kind}`),'japandi');
 assert.equal(d.validateDesignPiece(item,room),undefined);assert(item.sku.startsWith('ASAB-'));
 assert.equal(item.pricePending,kind!=='worktop');assert.equal(item.price,kind==='worktop'?370:0);
 if(kind!=='worktop')assert.equal(item.height,band==='base'?86.2:band==='wall'?70:220);
 const override={...item,finishOverride:{doorHex:'#ff0000',handle:'auriu',handleHex:'#C7A34B'}};
 assert.equal(d.effectiveCabinetColorway(override,{doorHex:'#ffffff'}).doorHex,'#ff0000');
 assert.deepEqual(JSON.parse(JSON.stringify(override)),override,'piece fields are plain JSON');
}
let filler=d.createDesignPiece('filler','base','A','f');
assert.equal(d.designPieceCenter(filler,400).z-filler.depth/2,56,'base filler back starts on dishwasher front plane');
for(const wall of ['A','B','C']){const c={...filler,wall};const centre=d.designPieceCenter(c,400);assert(Math.abs(placement.cabinetWallGapCm(c)+c.depth/2-(wall==='C'?400-centre.x:wall==='B'?centre.x:centre.z))<1e-8);}
assert.equal(d.designPieceCenter({...filler,placementMode:'free',freePosition:{x:120,z:140},rotationYDegrees:90},400).x,120);
assert(d.validateDesignPiece({...filler,height:300},room));assert(d.validateDesignPiece({...filler,width:NaN},room));assert(d.validateDesignPiece({...filler,manualPrice:-1},room));
let top=d.priceDesignPiece({...d.createDesignPiece('worktop','base','A','top'),width:205},'smart');assert.equal(top.price,370);
assert.equal(d.priceDesignPiece({...top,width:206},'smart').price,740);
assert(d.priceDesignPiece({...top,depth:90},'smart').pricePending);
assert(d.priceDesignPiece({...top,width:411},'smart').pricePending);
assert.equal(d.priceDesignPiece({...top,depth:90,manualPrice:900},'smart').price,900);
let result=p.calculateExportPricing([top],'linear',room);assert.equal(result.total,1110,'manual stock board plus automatic full run, once each');
top={...top,designPiece:{...top.designPiece,replacesRun:'A'}};
result=p.calculateExportPricing([top],'linear',room);assert.equal(result.total,370);assert.equal(result.worktopLengthCm,0,'replacement suppresses automatic stock bill');
assert.equal(p.calculateExportPricing([],'linear',room).total,740,'deletion restores automatic run');
const {applyCollectionToCabinet}=load('data/skus');
const colored={...top,finishOverride:{worktop:'darkwood',worktopHex:'#3F3328'}};
const repriced=applyCollectionToCabinet(colored,'franc');assert.equal(repriced.price,370);assert.deepEqual(repriced.finishOverride,colored.finishOverride);assert(repriced.sku.endsWith('FRANC'));
console.log('PASS: all piece bands, JSON persistence, door-plane alignment A/B/C, bounds, individual finishes, stock/pending/manual pricing and worktop replacement.');

const mixed=[{wall:'A',type:'base',width:220,price:0,runWorktopOverride:{worktop:'white-stone',worktopHex:'#FAF8F2'}},{wall:'C',type:'base',width:260,price:0}];
const mixedPrice=p.calculateExportPricing(mixed,'l-shape',{wallA:220,wallB:260,height:280,cornerSide:'left'},'stejar');
assert.equal(mixedPrice.worktopPrice,1110,'220 cm white board and 200 cm wood cut cannot share stock');
assert.equal(mixedPrice.worktopCuts[1].run,'C','mirror return follows actual cabinet wall');
const samePrice=p.calculateExportPricing(mixed,'l-shape',{wallA:220,wallB:260,height:280,cornerSide:'left'},'white-stone');
assert.equal(samePrice.stockByFinish.length,1,'an explicit matching finish shares the global stock group');
console.log('PASS: stock allocation never mixes different worktop finishes; mirrored return run matches the model.');

// Free creation must not require an empty wall slot; collection changes and JSON
// round-trips preserve its actual room position and rotation.
for(const kind of ['filler','end-panel','worktop'])for(const band of ['base','wall','tall']){
 const free=d.freeDesignPiece(d.createDesignPiece(kind,band,'A','free-'+kind+'-'+band),room);
 assert.equal(free.placementMode,'free');assert.deepEqual(free.freePosition,{x:200,z:150});
 assert.equal(d.validateDesignPiece(free,room),undefined);
 const moved={...free,freePosition:{x:150,z:120},rotationYDegrees:90};
 const restored=JSON.parse(JSON.stringify(applyCollectionToCabinet(moved,'franc')));
 assert.deepEqual(d.designPieceCenter(restored,room.wallA),{x:150,z:120,rotationYDegrees:90});
 assert.equal(d.validateDesignPiece(restored,room),undefined);
 assert(d.validateDesignPiece({...restored,freePosition:{x:-10,z:120}},room));
}
console.log('PASS: free creation for every panel band, coordinate/rotation updates, persistence, collection changes and room bounds.');
