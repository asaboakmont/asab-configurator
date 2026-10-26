/** Run against an ephemeral PostgreSQL engine, never a live Supabase database.
 * npm install --prefix /tmp/asab-portal-test @electric-sql/pglite
 * PGLITE_MODULE=/tmp/asab-portal-test/node_modules/@electric-sql/pglite/dist/index.js node tests/portalDatabase.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
const ids = Object.fromEntries(['customer','other','admin','designer','dealer','technician'].map((name,i)=>[name,`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`]));
const org='10000000-0000-4000-8000-000000000001', dealerOrg='10000000-0000-4000-8000-000000000002';
async function as(user) {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user || '']);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:user,is_anonymous:false})]);
  await db.exec('set role authenticated');
}
async function root(){ await db.exec('reset role'); }
async function rows(sql,args=[]){ return (await db.query(sql,args)).rows; }
async function denied(sql,args=[]){ await assert.rejects(()=>db.query(sql,args)); }
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;`);
  await db.exec(readFileSync(new URL('../supabase/migrations/202610220001_portal_foundation.sql',import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../supabase/migrations/202610220002_customer_portal.sql',import.meta.url),'utf8'));
  for (const id of Object.values(ids)) await db.query('insert into auth.users(id) values($1)',[id]);
  await db.query("insert into public.portal_organizations(id,name,kind) values($1,'ASAB','asab'),($2,'Dealer','dealer')",[org,dealerOrg]);
  for (const role of ['admin','designer','technician','dealer']) await db.query('insert into public.portal_memberships(organization_id,user_id,role) values($1,$2,$3)',[role==='dealer'?dealerOrg:org,ids[role],role]);
  await as(ids.customer);
  const project=(await rows("select * from public.portal_create_project('Kitchen A')"))[0];
  assert.equal(project.owner_id,ids.customer);
  assert.equal((await rows('select * from public.portal_profiles')).length,1);
  await denied("insert into public.portal_memberships values($1,$2,'admin',true)",[org,ids.customer]);
  await denied("update public.portal_projects set owner_id=$1 where id=$2",[ids.other,project.id]);
  await denied('select public.portal_assign_project($1,$2,$3,false)',[project.id,org,ids.designer]);
  const first=(await rows('select * from public.portal_save_revision($1,0,$2::jsonb)',[project.id,JSON.stringify({layout:'linear',cabinets:[]})]))[0];
  assert.equal(first.revision,1);
  await denied("select public.portal_save_revision($1,0,'{}')",[project.id]);
  await denied('update public.portal_configuration_revisions set configuration=\'{}\' where id=$1',[first.id]);
  await denied("select public.portal_save_revision($1,1,'{\"_lead\":{\"phone\":\"secret\"}}')",[project.id]);
  await as(ids.other);
  assert.equal((await rows('select * from public.portal_projects where id=$1',[project.id])).length,0);
  assert.equal((await rows('select * from public.portal_configuration_revisions where project_id=$1',[project.id])).length,0);
  await denied("select public.portal_rename_project($1,'stolen')",[project.id]);
  await as(ids.designer);
  assert.equal((await rows('select * from public.portal_projects')).length,0);
  await as(ids.admin);
  for (const role of ['designer','technician','dealer']) await rows('select public.portal_assign_project($1,$2,$3,false)',[project.id,role==='dealer'?dealerOrg:org,ids[role]]);
  await as(ids.designer);
  assert.equal((await rows('select * from public.portal_projects')).length,1);
  await rows("select public.portal_save_revision($1,1,'{\"layout\":\"linear\",\"cabinets\":[]}')",[project.id]);
  await as(ids.technician);
  assert.equal((await rows('select * from public.portal_projects')).length,1);
  await denied("select public.portal_save_revision($1,2,'{}')",[project.id]);
  await denied("select public.portal_rename_project($1,'changed')",[project.id]);
  await as(ids.admin);
  await rows('select public.portal_assign_project($1,$2,$3,true)',[project.id,org,ids.designer]);
  await as(ids.designer);
  assert.equal((await rows('select * from public.portal_projects')).length,0);
  await root();
  await db.query('update public.portal_memberships set active=false where user_id=$1',[ids.dealer]);
  await as(ids.dealer);
  assert.equal((await rows('select * from public.portal_projects')).length,0);
  await root();
  await db.query('update public.portal_memberships set active=true where user_id=$1',[ids.dealer]);
  // Prepare workflow records as database owner; authenticated users cannot write these tables yet.
  const room=(await rows("insert into public.portal_room_revisions(project_id,revision,measurements,created_by) values($1,1,'{}',$2) returning id",[project.id,ids.customer]))[0];
  const verification=(await rows("insert into public.portal_verifications(project_id,room_revision_id,status) values($1,$2,'verified') returning id",[project.id,room.id]))[0];
  await db.query("insert into public.portal_quotes(project_id,configuration_revision_id,verification_id,status,total_bani,price_snapshot,valid_until) values($1,$2,$3,'draft',10000,'{}',now()+interval '7 days')",[project.id,first.id,verification.id]);
  await as(ids.customer);
  assert.equal((await rows('select * from public.portal_quotes')).length,0,'customer must not see staff draft quotes');
  await as(ids.dealer);
  assert.equal((await rows('select * from public.portal_quotes')).length,1);
  await as(ids.technician);
  assert.equal((await rows('select * from public.portal_quotes')).length,0,'technician cannot read commercial records');
  await root();
  await db.exec("update public.portal_quotes set status='issued'");
  await as(ids.customer);
  assert.equal((await rows('select * from public.portal_quotes')).length,1);
  await denied("update public.portal_quotes set status='accepted',accepted_at=now()");
  await denied("insert into public.portal_orders(project_id,quote_id) select project_id,id from public.portal_quotes");
  await root();
  await db.query("update public.portal_projects set status='quoted' where id=$1",[project.id]);
  await as(ids.customer);
  await denied("select public.portal_save_revision($1,2,'{}')",[project.id]);
  assert.equal((await rows('select * from public.portal_audit_events')).length,0);
  await as(ids.admin);
  assert.ok((await rows('select * from public.portal_audit_events')).length>=6);
  await as(ids.customer);
  const copy=(await rows('select * from public.portal_duplicate_project($1)',[project.id]))[0];
  assert.equal(copy.status,'draft'); assert.equal(copy.version,1);
  assert.equal((await rows('select * from public.portal_configuration_revisions where project_id=$1',[copy.id])).length,1);
  assert.equal((await rows('select * from public.portal_verifications where project_id=$1',[copy.id])).length,0);
  await denied('select public.portal_archive_project($1)',[project.id]);
  await rows('select public.portal_archive_project($1)',[copy.id]);
  const dashboard=(await rows('select public.portal_dashboard(0) as projects'))[0].projects;
  assert.equal(dashboard.length,1); assert.equal(dashboard[0].id,project.id);
  await denied("insert into public.portal_commerce_links(user_id,store_url,customer_id) values($1,'https://asab-design.ro',17)",[ids.customer]);
  await root();
  await db.query("insert into public.portal_commerce_links(user_id,store_url,customer_id) values($1,'https://asab-design.ro',17)",[ids.customer]);
  await as(ids.other);
  assert.equal((await rows('select * from public.portal_commerce_links')).length,0);
  await denied('select public.portal_duplicate_project($1)',[project.id]);
  await denied('select public.portal_archive_project($1)',[copy.id]);
  await as(ids.customer);
  assert.equal((await rows('select * from public.portal_commerce_links')).length,1);
  // Anonymous REST and anonymous auth users cannot create/read project data.
  await root(); await db.exec('set role anon');
  await denied('select * from public.portal_projects');
  await denied("select public.portal_create_project('anonymous')");
  await as(ids.customer);
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:ids.customer,is_anonymous:true})]);
  await denied("select public.portal_create_project('anonymous auth')");
  assert.equal((await rows('select * from public.portal_projects')).length,0);
  console.log('PASS: PostgreSQL migration, ownership, RLS, assignment/revocation, inactive staff, role escalation, revision conflicts/immutability, quote visibility, locked designs, audit privacy, anonymous denial');
} catch (error) { console.error(error.message, error.code, error.query); process.exitCode=1; } finally { await db.close(); }
