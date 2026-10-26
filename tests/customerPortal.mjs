import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
const require=createRequire(new URL('../package.json',import.meta.url));const ts=require('typescript');const {NextRequest}=require('next/server');
const modules=new Map();let jar=new Map();
const cookieStore={get:name=>jar.has(name)?{value:jar.get(name).value}:undefined,set:(name,value,options)=>jar.set(name,{value,options})};
function load(path){if(modules.has(path))return modules.get(path).exports;const file=new URL('../'+path,import.meta.url).pathname;const m=new Module(file);modules.set(path,m);m.filename=file;m.require=name=>name==='next/headers'?{cookies:()=>cookieStore}:name.startsWith('@/')?load(name.slice(2)+'.ts'):name==='./server'?load('lib/portal/server.ts'):require(name);m._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return m.exports;}
const auth=load('app/api/portal/auth/[action]/route.ts');const server=load('lib/portal/server.ts');
const internalCookie=()=> 'asab_internal_session='+load('lib/auth/internalSession.ts').createInternalSession('admin');
const originalFetch=globalThis.fetch;const savedEnv={...process.env};
const origin='http://127.0.0.1:3011';const userId='00000000-0000-4000-8000-000000000001';
function request(action,body,extraHeaders={}){return new NextRequest(origin+'/api/portal/auth/'+action,{method:'POST',headers:{origin,'Content-Type':'application/json',cookie:internalCookie()+'; '+[...jar].map(([name,{value}])=>name+'='+value).join('; '),...extraHeaders},body:JSON.stringify(body)});}
try{
 process.env.ASAB_INTERNAL_SESSION_SECRET='customer-preview-test-secret';
 process.env.SUPABASE_URL='https://test.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_test';process.env.PORTAL_PUBLIC_URL=origin;
 let fetched=0;globalThis.fetch=async()=>{fetched++;return Response.json({access_token:'access',refresh_token:'refresh',expires_in:3600,user:{id:userId}});};
 const publicAttempt=await auth.POST(new NextRequest(origin+'/api/portal/auth/email',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({email:'test@example.invalid'})}),{params:{action:'email'}});assert.equal(publicAttempt.status,403);assert.equal(fetched,0,'public preview login cannot send email');
 assert.equal((await auth.POST(request('login',{email:'test@example.invalid',password:'password'}),{params:{action:'login'}})).status,200);
 assert.equal(jar.get('asab_portal_refresh').options.httpOnly,true);assert.equal(jar.get('asab_portal_access').options.sameSite,'lax');assert.equal(jar.get('asab_portal_refresh').options.maxAge,2592000);
 assert.equal((await auth.POST(request('login',{email:'test@example.invalid',password:'password'},{origin:'https://evil.invalid'}),{params:{action:'login'}})).status,403);
 assert.equal(fetched,1);
 assert.equal((await auth.POST(request('register',{email:'test@example.invalid',password:'short'}),{params:{action:'register'}})).status,400);
 jar=new Map();globalThis.fetch=async()=>Response.json({user:{id:userId}});
 const registration=await auth.POST(request('register',{email:'test@example.invalid',password:'long-password'}),{params:{action:'register'}});
 assert.equal((await registration.json()).authenticated,false);assert.equal(jar.has('asab_portal_access'),false,'unconfirmed signup must not create a session');assert.ok(jar.has('asab_portal_pkce'));
 const pending=jar.get('asab_portal_pkce').value;
 globalThis.fetch=async(url,init)=>{assert.ok(url.includes('grant_type=pkce'));assert.equal(JSON.parse(init.body).auth_code,'confirmation-code');return Response.json({access_token:'confirmed',refresh_token:'confirmed-refresh',user:{id:userId,email:'test@example.invalid'}});};
 const confirmed=await auth.GET(new NextRequest(origin+'/api/portal/auth/confirm?code=confirmation-code',{headers:{cookie:internalCookie()+'; asab_portal_pkce='+pending}}),{params:{action:'confirm'}});
 assert.equal(confirmed.headers.get('location'),origin+'/cont');assert.equal(jar.get('asab_portal_access').value,'confirmed');
 const noVerifier=await auth.GET(new NextRequest(origin+'/api/portal/auth/confirm?code=unbound',{headers:{cookie:internalCookie()}}),{params:{action:'confirm'}});assert.ok(noVerifier.headers.get('location').includes('expired=1'));
 // Passwordless requests never establish a session; verification must prove ownership.
 jar=new Map();globalThis.fetch=async(url,init)=>{assert.ok(url.endsWith('/otp'));assert.deepEqual(JSON.parse(init.body),{email:'test@example.invalid',create_user:true});return Response.json({});};
 const sent=await auth.POST(request('email',{email:' Test@Example.invalid '}),{params:{action:'email'}});assert.equal(sent.status,200);assert.equal(jar.has('asab_portal_access'),false);
 assert.equal((await auth.POST(request('email',{email:'bad'}),{params:{action:'email'}})).status,400);
 assert.equal((await auth.POST(request('verify-email',{email:'test@example.invalid',code:'12abc3'}),{params:{action:'verify-email'}})).status,400);
 globalThis.fetch=async()=>Response.json({error:'expired'},{status:403});
 const expired=await auth.POST(request('verify-email',{email:'test@example.invalid',code:'000123'}),{params:{action:'verify-email'}});assert.equal(expired.status,400);assert.equal(jar.has('asab_portal_access'),false);
 globalThis.fetch=async(url,init)=>{assert.ok(url.endsWith('/verify'));assert.deepEqual(JSON.parse(init.body),{email:'test@example.invalid',token:'000123',type:'email'});return Response.json({access_token:'otp-access',refresh_token:'otp-refresh',expires_in:3600,user:{id:userId,email:'test@example.invalid'}});};
 assert.equal((await auth.POST(request('verify-email',{email:'test@example.invalid',code:'000123'}),{params:{action:'verify-email'}})).status,200);assert.equal(jar.get('asab_portal_access').value,'otp-access');assert.equal(jar.get('asab_portal_access').options.httpOnly,true);
 jar=new Map();globalThis.fetch=async()=>Response.json({access_token:'wrong-user',refresh_token:'wrong-refresh',user:{id:userId,email:'someone-else@example.invalid'}});
 assert.equal((await auth.POST(request('verify-email',{email:'test@example.invalid',code:'123456'}),{params:{action:'verify-email'}})).status,400);assert.equal(jar.has('asab_portal_access'),false);
 globalThis.fetch=async()=>Response.json({},{status:429});assert.equal((await auth.POST(request('email',{email:'test@example.invalid'}),{params:{action:'email'}})).status,429);
 // An expired cookie is refreshed on the server and RLS receives the new token.
 jar.set('asab_portal_access',{value:'expired'});jar.set('asab_portal_refresh',{value:'valid-refresh'});
 let requests=[];globalThis.fetch=async(url,init)=>{requests.push({url,init});if(url.includes('grant_type=refresh_token'))return Response.json({access_token:'fresh',refresh_token:'rotated',expires_in:3600});if(url.endsWith('/auth/v1/user'))return init.headers.Authorization==='Bearer fresh'?Response.json({id:userId}):Response.json({},{status:401});return Response.json([]);};
 const read=new NextRequest(origin+'/api/portal/me',{headers:{cookie:internalCookie()+'; asab_portal_access=expired; asab_portal_refresh=valid-refresh'}});
 const session=await server.portalSession(read);await session.data('portal_projects?select=id');
 assert.equal(jar.get('asab_portal_refresh').value,'rotated');assert.equal(requests.at(-1).init.headers.Authorization,'Bearer fresh');
 await assert.rejects(()=>server.portalSession(request('projects',{} ,{origin:'https://evil.invalid'})),e=>e.status===403);
 const client=load('lib/portal/client.ts');assert.equal(client.safePortalNext('//evil.invalid'),'/cont');assert.equal(client.safePortalNext('/\t/evil.invalid'),'/cont');assert.equal(client.safePortalNext('/\\evil.invalid'),'/cont');assert.equal(client.safePortalNext('/?project=abc'),'/?project=abc');
 // Logout discards both browser cookies even if the auth provider is unavailable.
 globalThis.fetch=async()=>{throw new Error('offline');};
 assert.equal((await auth.POST(request('logout',{}),{params:{action:'logout'}})).status,200);
 assert.equal(jar.get('asab_portal_refresh').options.maxAge,0);
 console.log('PASS: customer login/signup, HttpOnly cookies, CSRF, server refresh, RLS token forwarding, email OTP/PKCE, wrong-code and identity rejection, rate limits, logout and safe redirects');
}finally{globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in savedEnv))delete process.env[key];Object.assign(process.env,savedEnv);}
