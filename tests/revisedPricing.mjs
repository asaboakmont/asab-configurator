import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const root=process.env.ASAB_TEST_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'package.json')),ts=require('typescript'),cache=new Map();
function load(name){
 const file=name.startsWith('@/')?path.join(root,name.slice(2)+'.ts'):name;
 if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;
 new Function('require','exports','module',code)(n=>n.startsWith('@/')?load(n):require(n),module.exports,module);
 return module.exports;
}
const {revisedPrice,MODEL_FAMILIES}=load('@/lib/pricing/catalogPrices');
const {REVISED_CATALOGUE}=load('@/data/revisedCatalogue');
const {applyCollectionToCabinet,getSkuByCode}=load('@/data/skus');
const {calculateExportPricing}=load('@/lib/pricing/exportPricing');
for(const row of REVISED_CATALOGUE.filter(r=>r.sku.startsWith('ASAB-')&&!r.sku.startsWith('ASAB-ACC'))){
 for(const collection of ['japandi','germain','franc'])assert.equal(revisedPrice(row.sku,row.widthMm/10,collection)?.price,row.prices[collection]);
}
assert.equal(REVISED_CATALOGUE.find(r=>r.sku==='ASB-SINA').prices.japandi,40);
assert.equal(revisedPrice('1008',35,'japandi').price,366,'explicit custom-size price beats formula');
assert.equal(revisedPrice('1008',35.001,'japandi'),undefined,'fractional millimetres cannot match exact catalogue size');
assert.equal(getSkuByCode('1003-jpn').price,803);
assert.equal(getSkuByCode('1003-frc').price,1393);
const base={id:'base',sku:'1008-jpn',baseSku:'1008',type:'base',wall:'A',width:35,height:86,depth:53,xPos:0,price:1,standardWidth:40};
const listed=applyCollectionToCabinet(base,'japandi');
assert.equal(listed.price,366);assert.equal(listed.baseSku,'1008');assert.equal(listed.displaySku,'ASAB-CI-1U-RAFT-W0350-JPN');assert.equal(listed.customPriceBreakdown,undefined);
assert.equal(applyCollectionToCabinet(listed,'franc').price,626);
const custom=applyCollectionToCabinet({...base,width:37},'japandi');assert.equal(custom.priceSource,'custom');assert(custom.customPriceBreakdown);
const legacy=applyCollectionToCabinet({...base,sku:'1015',baseSku:'1015',type:'base-dishwasher',width:60,standardWidth:60},'japandi');assert.equal(legacy.priceSource,'legacy');assert(legacy.pricingNote);
const cabinets=[{price:1000},{price:500}];
for(const cm of [0,120,205,206,410,411,615,616]){
 const p=calculateExportPricing(cabinets,'linear',{wallA:cm});assert.equal(p.worktopPrice,Math.round(cm*145)/100);assert.equal(p.total,1500+p.worktopPrice);
}
assert.equal(calculateExportPricing(cabinets,'l-shape',{wallA:300,wallB:180}).worktopLengthCm,420);
assert.equal(calculateExportPricing([{type:'tall',wall:'A',width:60,price:1000}],'linear',{wallA:300}).worktopLengthCm,240);
assert.equal(calculateExportPricing(cabinets,'linear',{wallA:300,hasIsland:true,islandWidth:180}).worktopLengthCm,480);
assert.equal(calculateExportPricing(cabinets,'peninsula',{wallA:300,peninsulaWidth:160}).worktopLengthCm,460);
assert.equal(calculateExportPricing([{price:1000.12},{price:500.34}],'linear',{wallA:205}).total,1797.71);
const {kitchenIsometricDirection}=load('@/lib/pdf/technicalViews');
assert.deepEqual(kitchenIsometricDirection([{wall:'A'},{wall:'B'}]).toArray(),[1,1,1]);
assert.deepEqual(kitchenIsometricDirection([{wall:'A'},{wall:'C'}]).toArray(),[-1,1,1]);
const {doorHingeSides}=load('@/lib/pdf/hinges');
assert.deepEqual(doorHingeSides({...base,doorDirection:'S'}),['left']);
assert.deepEqual(doorHingeSides({...base,doorDirection:'D'}),['right']);
assert.deepEqual(doorHingeSides({...base,baseSku:'1013',sku:'1013',doorDirection:'D'}),['left','right']);
assert.deepEqual(doorHingeSides({...base,type:'wall-hood',sku:'2007',baseSku:'2007',label:'Hota telescopica',doorDirection:'S'}),['left']);
assert.deepEqual(doorHingeSides({...base,type:'wall-hood',displaySku:'ASAB-CS-HOTA-W0600-JPN',label:'Hota telescopica',doorDirection:'D'}),['right']);
assert.deepEqual(doorHingeSides({...base,type:'base-drawer'}),[]);
assert.deepEqual(doorHingeSides({...base,type:'base-oven'}),[]);
assert.deepEqual(doorHingeSides({...base,type:'base-corner'}),[]);
assert.deepEqual(doorHingeSides({...base,baseSku:undefined,sku:'unknown',catalogProduct:{sku:'unknown',name:'Cabinet'}}),[]);
const {createKitchenPDF}=load('@/lib/pdf/exportPDF');
const fixtures=[listed,
 applyCollectionToCabinet({...base,id:'drawers',baseSku:'1003',sku:'1003',type:'base-drawer',width:60,standardWidth:60,xPos:35},'japandi'),
 applyCollectionToCabinet({...base,id:'tall',baseSku:'1011B',sku:'1011B',type:'tall-oven',width:60,standardWidth:60,height:216,xPos:95},'japandi'),
 applyCollectionToCabinet({...base,id:'corner',baseSku:'1001-STG',sku:'1001-STG',type:'base-corner',width:95,standardWidth:95,xPos:155},'japandi')];
const doc=createKitchenPDF({enhancedPDF:true,cabinets:fixtures,colorway:{name:'Alb mat',finish:'mat',doorHex:'#ffffff',worktopHex:'#cccccc',worktop:'stejar'},handle:'inox',totalPrice:0,layout:'linear',dimensions:{wallA:300,height:250},collection:'japandi',includeCabinetTotal:true});
assert(doc.getNumberOfPages()>=5,'summary plus cabinet pages');
assert.equal(doc.internal.pages.filter(p=>p.join(' ').includes('Interior schematic')).length,fixtures.length,'exactly one detail page per cabinet');
const content=doc.internal.pages.flat().join("\n");assert(content.includes('Interior schematic'));assert(content.includes('ASAB-CI-1U-RAFT-W0350-JPN'));assert(!content.includes('nu includ TVA'));
const imageFixture={label:'Randare color de test',aspect:2/3,dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAE0lEQVR4nGP8//8/AwwwwVl4OQCWbgMF7ZjH1AAAAABJRU5ErkJggg=='};
const illustrated=createKitchenPDF({enhancedPDF:true,cabinets:fixtures,colorway:{name:'Alb mat',finish:'mat',doorHex:'#ffffff',worktopHex:'#cccccc',worktop:'stejar'},handle:'inox',totalPrice:0,layout:'linear',dimensions:{wallA:300,height:250},collection:'japandi',screenshots:[imageFixture],technicalViews:[{...imageFixture,label:'Bucatarie 3D in contur'},{...imageFixture,label:'Bucatarie izometrica fara fronturi'}]});
assert(illustrated.internal.pages.some(p=>p.join(' ').includes('Randare color de test')));
assert(illustrated.internal.pages.some(p=>p.join(' ').includes('Subtotal corpuri TVA inclus')),'cabinet subtotal is visible in the customer PDF');
assert(illustrated.internal.pages.some(p=>p.join(' ').includes('Deschidere: stanga')));
assert(illustrated.internal.pages.some(p=>p.join(' ').includes('Bucatarie 3D in contur')));
assert(illustrated.internal.pages.some(p=>p.join(' ').includes('Bucatarie izometrica fara fronturi')));
assert(illustrated.getNumberOfPages()>=doc.getNumberOfPages()+3,'colour render, outline and doorless isometric each add a page');
if(process.env.ASAB_SAMPLE_PDF)fs.writeFileSync(process.env.ASAB_SAMPLE_PDF,Buffer.from(doc.output('arraybuffer')));
console.log('PASS: 81 catalogue sizes x 3 live collections, stable model IDs, exact-size precedence, custom fallback, legacy notes, shared worktop totals and per-cabinet PDF pages.');

const opts={cabinets:fixtures,colorway:{name:'Alb mat',finish:'mat',doorHex:'#ffffff',worktopHex:'#cccccc',worktop:'stejar'},handle:'inox',totalPrice:0,layout:'linear',dimensions:{wallA:300,height:250},screenshots:[imageFixture],technicalViews:[{...imageFixture,label:'Bucatarie 3D in contur'},{...imageFixture,label:'Bucatarie izometrica fara fronturi'}]};
const publicPDF=createKitchenPDF(opts);const publicText=publicPDF.internal.pages.flat().join(' ');
assert(!publicText.includes('Interior schematic'));assert(!publicText.includes('Bucatarie 3D in contur'));assert(!publicText.includes('nu includ TVA'));
const pages=illustrated.internal.pages.slice(1).map(p=>p.join(' '));
assert(pages[0].includes('Randare color de test'));assert(pages[1].includes('Bucatarie 3D in contur'));assert(pages[2].includes('Bucatarie izometrica fara fronturi'));assert(pages[3].includes('Rezumat configuratie'));
console.log('PASS: public PDF remains compact; enhanced detail pages opt in; full-kitchen isometrics follow the colour views.');
