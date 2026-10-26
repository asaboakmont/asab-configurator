import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root=process.env.ASAB_TEST_ROOT??path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'package.json')),ts=require('typescript'),cache=new Map();
function load(name){
 const file=path.join(root,name==='middleware'?'middleware.ts':name.slice(2)+'.ts');if(cache.has(file))return cache.get(file).exports;
 const m={exports:{}};cache.set(file,m);
 new Function('require','exports','module',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText)(n=>n.startsWith('@/')?load(n):require(n),m.exports,m);return m.exports;
}
process.env.ASAB_INTERNAL_SESSION_SECRET='preview-security-test-only-secret';
const auth=load('@/lib/auth/internalSession'),edge=load('@/lib/auth/internalPreviewEdge');
const { middleware,config }=load('middleware'),{NextRequest}=require('next/server');
for(const role of ['admin','designer']){
 const token=auth.createInternalSession(role);assert.equal(await edge.verifiedPreviewRole(token,process.env.ASAB_INTERNAL_SESSION_SECRET),role);
 const response=await middleware(new NextRequest('http://localhost/api/portal/me',{headers:{cookie:`asab_internal_session=${token}`}}));assert.equal(response.headers.get('x-middleware-next'),'1');assert.equal(response.headers.get('cache-control'),'private, no-store');
}
for(const token of [undefined,'admin',Buffer.from(JSON.stringify({role:'admin',expiresAt:Date.now()+100000})).toString('base64url')+'.forged'])assert.equal(await edge.verifiedPreviewRole(token,process.env.ASAB_INTERNAL_SESSION_SECRET),null);
assert.equal(await edge.verifiedPreviewRole(auth.createInternalSession('admin'),'wrong-secret'),null);
const oldNow=Date.now;Date.now=()=>oldNow()-13*3600000;const expired=auth.createInternalSession('designer');Date.now=oldNow;assert.equal(await edge.verifiedPreviewRole(expired,process.env.ASAB_INTERNAL_SESSION_SECRET),null);
for(const url of ['/cont/autentificare','/api/portal/auth/email','/models/catalogue-optimized/japandi/ASAB-CS-HOTA-W0600-JPN.glb']){
 const result=await middleware(new NextRequest('http://localhost'+url));assert.equal(result.status,403);assert.equal(result.headers.get('cache-control'),'private, no-store');
}
assert(config.matcher.includes('/api/portal/:path*'));assert(config.matcher.includes('/models/catalogue-optimized/:path*'));
const store=load('@/store/configuratorStore').useConfigStore;
store.getState().setCollection('smart');assert.equal(store.getState().collection,'japandi');store.getState().generate();
let cabinets=store.getState().cabinets;assert(cabinets.length);assert(!cabinets.some(c=>c.sku.startsWith('ASAB-')));assert(cabinets.filter(c=>c.type.startsWith('wall')).every(c=>c.mountHeightCm===146.9));
assert.equal(auth.usesInternalCabinetFeatures({collection:'japandi',cabinets}),false);
store.getState().setInternalRole('designer');assert(store.getState().internalSessionReady);store.getState().setCollection('smart');assert.equal(store.getState().collection,'smart');
const {nativeProduct,nativeDimensions}=load('@/lib/catalog/nativeCatalogue');const sp=nativeProduct('ASAB-SP-1U-W0600',60,'smart');
store.getState().restoreCabinets([{sku:sp.sku,type:'wall',width:60,...nativeDimensions(sp),wall:'A',xPos:0,price:sp.price}]);assert.equal(store.getState().cabinets[0].mountHeightCm,220);
store.getState().setInternalRole(null);assert.equal(store.getState().collection,'japandi');assert.equal(store.getState().dimensions.height,240);assert(!store.getState().cabinets.some(c=>c.sku.startsWith('ASAB-')));
assert.throws(()=>store.getState().restoreCabinets([{sku:sp.sku,type:'wall',width:60,height:40,depth:57.8,wall:'A',xPos:0,price:531}]));
for(const configuration of [{internalPreview:true},{collection:'smart'},{cabinets:[{sku:sp.sku}]},{cabinets:[{drainerSku:'ASAB-ACC-SCURG-W0600-COM'}]},{cabinets:[{sku:'2010-jpn',mountHeightCm:150}]}])assert(auth.usesInternalCabinetFeatures(configuration));
const viewer=fs.readFileSync(path.join(root,'components/viewer/StepViewer.tsx'),'utf8');assert(viewer.includes('enhancedPDF: true'));assert(viewer.includes('const technical = liveScene'));assert(viewer.includes('{isInternal && <button type="button" onClick={() => { setHDRenderTarget("png")'));
console.log('PASS: signed admin/designer access; expired/forged/absent sessions denied; direct portal/model routes protected; public legacy catalogue; role-expiry reset; new public PDF; HD remains internal.');
