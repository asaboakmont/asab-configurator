import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
const require = createRequire(new URL('../package.json', import.meta.url));
const ts = require('typescript');
const { NextRequest } = require('next/server');
const compiled = new Map();
function load(relative) {
  if (compiled.has(relative)) return compiled.get(relative);
  const file = new URL(`../${relative}`, import.meta.url).pathname;
  const module = new Module(file);
  module.filename = file;
  module.paths = [];
  module.require = (name) => name.startsWith('@/') ? load(name.slice(2)+'.ts') : require(name);
  module._compile(ts.transpileModule(readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
  compiled.set(relative,module.exports);
  return module.exports;
}
const server = load('lib/portal/server.ts');
const projects = load('app/api/portal/projects/route.ts');
const revisions = load('app/api/portal/projects/[projectId]/revisions/route.ts');
const assignments = load('app/api/portal/admin/assignments/route.ts');
const id = '00000000-0000-4000-8000-000000000001';
const originalFetch=globalThis.fetch;
const env={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_PUBLISHABLE_KEY};
let calls=[];
function request(path,body,auth=true) { return new NextRequest(`http://localhost/api/portal/${path}`, {method:body===undefined?'GET':'POST',headers:{...(auth?{Authorization:'Bearer user-session-token'}:{}),'Content-Type':'application/json',cookie:'asab_internal_session='+load('lib/auth/internalSession.ts').createInternalSession('designer')},...(body===undefined?{}:{body:JSON.stringify(body)})}); }
function mock(handler) {
  calls=[];
  globalThis.fetch=async (url,init)=>{
    calls.push({url,init});
    assert.equal(init.cache,'no-store');
    assert.equal(init.headers.Authorization,'Bearer user-session-token');
    if(url.endsWith('/auth/v1/user')) return Response.json({id,email:'test@example.invalid'});
    return handler(url,init);
  };
}
try {
  process.env.ASAB_INTERNAL_SESSION_SECRET='portal-preview-test-secret';
  process.env.SUPABASE_URL='https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
  mock(()=>{throw new Error('unexpected fetch');});
  assert.equal((await projects.GET(request('projects',undefined,false))).status,401);
  assert.equal(calls.length,0,'legacy cookie/unauthenticated calls must not reach data');
  const legacy = new NextRequest('http://localhost/api/portal/projects',{headers:{cookie:'asab_internal_session=legacy-shared-admin'}});
  assert.equal((await projects.GET(legacy)).status,403);
  assert.equal((await projects.GET(new NextRequest('http://localhost/api/portal/projects',{headers:{Authorization:'Bearer user-session-token'}}))).status,403);
  assert.equal(calls.length,0,'a customer token alone cannot bypass the internal preview gate');
  mock(()=>Response.json([]));
  const list=await projects.GET(request('projects'));
  assert.equal(list.status,200); assert.equal(list.headers.get('cache-control'),'private, no-store');
  assert.ok(calls[1].url.endsWith('portal_projects?select=*&order=updated_at.desc,id.asc&limit=50&offset=0'));
  assert.equal((await projects.GET(request('projects?offset=0%26select=*'))).status,400);
  mock((url,init)=>{
    assert.ok(url.endsWith('/rpc/portal_create_project'));
    assert.deepEqual(JSON.parse(init.body),{p_title:'Kitchen'});
    return Response.json([{id,owner_id:id}]);
  });
  const created=await projects.POST(request('projects',{title:' Kitchen ',owner_id:'forged',role:'admin'}));
  assert.equal(created.status,201); assert.equal((await created.json()).project.id,id,'unwrap composite RPC response');
  assert.equal((await projects.POST(request('projects',{title:''}))).status,400);
  mock(()=>Response.json({code:'40001',details:'sensitive database details'},{status:409}));
  const conflict=await revisions.POST(request('projects/x/revisions',{expectedVersion:1,configuration:{layout:'linear'}}),{params:{projectId:id}});
  assert.equal(conflict.status,409); assert.ok(!(await conflict.text()).includes('sensitive'));
  mock(()=>Response.json({code:'42501'},{status:403}));
  assert.equal((await assignments.POST(request('admin/assignments',{projectId:id,organizationId:id,userId:id}))).status,403);
  assert.equal((await revisions.POST(request('projects/x/revisions',{expectedVersion:-1,configuration:{}}),{params:{projectId:id}})).status,400);
  assert.equal((await revisions.GET(request('projects/x/revisions'),{params:{projectId:'x&select=*'}})).status,400);
  const invalid=new NextRequest('http://localhost',{method:'POST',body:'{'});
  await assert.rejects(()=>server.portalBody(invalid),e=>e.status===400);
  const huge=new NextRequest('http://localhost',{method:'POST',body:'x'.repeat(1048577)});
  await assert.rejects(()=>server.portalBody(huge),e=>e.status===413);
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_secret_forbidden';
  assert.equal((await projects.GET(request('projects'))).status,503);
  process.env.SUPABASE_PUBLISHABLE_KEY=`eyJtest.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.test`;
  assert.equal((await projects.GET(request('projects'))).status,503);
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  assert.equal((await projects.GET(request('projects'))).status,503);
  process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';
  globalThis.fetch=async()=>Response.json({is_anonymous:true,id});
  assert.equal((await projects.GET(request('projects'))).status,401);
  globalThis.fetch=async()=>Response.json({error:'expired'},{status:401});
  assert.equal((await projects.GET(request('projects'))).status,401);
  globalThis.fetch=async()=>{throw new Error('offline');};
  assert.equal((await projects.GET(request('projects'))).status,503);
  console.log('PASS: portal authentication, shared-login rejection, user-token forwarding, no-store responses, owner spoofing, input/size validation, conflict mapping, admin denial, secret-key rejection and unavailable services');
} finally {
  globalThis.fetch=originalFetch;
  for(const [key,value] of Object.entries({SUPABASE_URL:env.url,SUPABASE_PUBLISHABLE_KEY:env.key})) { if(value===undefined) delete process.env[key]; else process.env[key]=value; }
}
