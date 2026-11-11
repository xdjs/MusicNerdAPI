import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { userInfo } from 'node:os';
import assert from 'node:assert/strict';
import postgres from 'postgres';
const bin='/tmp/mn-pg17-build/runtime/bin';
assert.match(execFileSync(`${bin}/postgres`,['--version'],{encoding:'utf8'}),/PostgreSQL\) 17\./);
const dir=mkdtempSync('/tmp/mn1655-lock-');
const env={...process.env};
for(const k of Object.keys(env))if(k.startsWith('PG'))delete env[k];
const run=(name,args)=>execFileSync(`${bin}/${name}`,args,{env,stdio:'pipe'});
let started=false,a,b,c;
let passed=0; const pass=msg=>{passed++;console.log(`PASS ${msg}`)};
const artist='00000000-0000-4000-8000-000000000001';
try {
 run('initdb',['-D',`${dir}/data`,'--auth-local=trust','--auth-host=reject','--no-locale']);
 run('pg_ctl',['-D',`${dir}/data`,'-l',`${dir}/server.log`,'-o',`-c listen_addresses='' -c unix_socket_directories='${dir}' -c unix_socket_permissions=0700 -p 55466`,'-w','start']);started=true;
 const opts={host:dir,port:55466,database:'postgres',max:1,prepare:false,connection:{statement_timeout:3000}};
 a=postgres({...opts,user:userInfo().username});
 await a.unsafe(`create role mnweb login nosuperuser nobypassrls;create role anon;create role authenticated;
 create schema mn_private;revoke all on schema mn_private from public;grant usage on schema mn_private to mnweb;
 revoke create on schema public from public;grant usage on schema public to mnweb;
 create table public.artist_activity_events(id uuid primary key,artist_id uuid,source_id uuid,actor_user_id uuid,trigger text);
 create table public.artist_vault_sources(id uuid primary key,artist_id uuid,activity_id uuid,publication text);
 alter table public.artist_activity_events enable row level security;
 create policy app_read on public.artist_activity_events for select to mnweb using(true);
 create policy app_insert on public.artist_activity_events for insert to mnweb with check(true);
 grant select,insert on public.artist_activity_events to mnweb;
 grant select,insert,update,delete on public.artist_vault_sources to mnweb;
 insert into public.artist_activity_events values('${artist}','${artist}','${artist}',null,'trusted_submission');
 insert into public.artist_vault_sources values('${artist}','${artist}','${artist}','inherit');`);
 b=postgres({...opts,user:'mnweb'});c=postgres({...opts,user:userInfo().username});
 for(const id of [artist,'00000000-0000-4000-8000-000000000099']){
  await assert.rejects(b`select id from public.artist_activity_events where artist_id=${id}::uuid for share`,{code:'42501'});
 }pass('restricted mnweb reproduces 42501 with populated and empty matches');
 const migration=readFileSync(new URL('./migration.sql',import.meta.url),'utf8');
 await a.unsafe('create role unexpected_reader;alter default privileges grant execute on functions to unexpected_reader');
 await assert.rejects(a.begin(async tx=>{await tx.unsafe(migration)}),{code:'P0001'});
 assert.equal((await a`select to_regprocedure('mn_private.lock_lore_activity_events(uuid)') as fn`)[0].fn,null);
 await a.unsafe('alter default privileges revoke execute on functions from unexpected_reader');
 pass('unexpected default function grant aborts migration atomically');
 await a.begin(async tx=>{await tx.unsafe(migration)});
 await assert.rejects(a.begin(async tx=>{await tx.unsafe(migration)}),{code:'42723'});
 const [meta]=await a`select p.prosecdef,p.proconfig,pg_get_userbyid(p.proowner) as owner,has_function_privilege('anon',p.oid,'execute') as anon,has_function_privilege('authenticated',p.oid,'execute') as authenticated from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='mn_private' and p.proname='lock_lore_activity_events'`;
 assert.equal(meta.prosecdef,true);assert.deepEqual(meta.proconfig,['search_path=pg_catalog']);assert.equal(meta.owner,userInfo().username);assert.equal(meta.anon,false);assert.equal(meta.authenticated,false);pass('migration refuses name collision; exact controlled owner, fixed path, no public execution');
 const lock=async tx=>{await tx`select id from public.artist_vault_sources where artist_id=${artist}::uuid order by id for share`;await tx`select mn_private.lock_lore_activity_events(${artist}::uuid)`};
 await b.begin(lock);pass('restricted mnweb obtains locks without UPDATE grant');
 await assert.rejects(b`update public.artist_activity_events set trigger='changed'`,{code:'42501'});
 await assert.rejects(b`delete from public.artist_activity_events`,{code:'42501'});pass('event UPDATE and DELETE remain denied');
 await b.begin(async tx=>{
  await lock(tx);
  for(const statement of ["delete from public.artist_activity_events", "update public.artist_activity_events set actor_user_id=gen_random_uuid()", "update public.artist_activity_events set trigger='untrusted'", "update public.artist_activity_events set source_id=gen_random_uuid()", "update public.artist_vault_sources set activity_id=gen_random_uuid()"]){
   await assert.rejects(c.begin(async other=>{await other.unsafe("set local lock_timeout='100ms'");await other.unsafe(statement)}),{code:'55P03'});
  }
 });pass('concurrent deletion, anonymization, trust edits and source relinking are blocked');
 await assert.rejects(b.begin(async tx=>{await lock(tx);throw Error('rollback probe')}),/rollback probe/);
 await c`update public.artist_activity_events set trigger='untrusted'`;
 await b.begin(async tx=>{await lock(tx);const rows=await tx`select v.id from public.artist_vault_sources v join public.artist_activity_events e on e.id=v.activity_id where v.artist_id=${artist}::uuid and e.trigger='trusted_submission'`;assert.equal(rows.length,0)});
 pass('rollback releases locks and subsequent normal-role check sees trust withdrawal');
 await assert.rejects(a.begin(async tx=>{await tx.unsafe('drop function mn_private.lock_lore_activity_events(uuid)');throw Error('migration rollback')}),/migration rollback/);
 await b.begin(lock);pass('migration transaction rollback restores helper');
 await a.unsafe('drop function mn_private.lock_lore_activity_events(uuid)');
 await assert.rejects(b.begin(lock),{code:'42883'});pass('missing helper fails closed');
 console.log(`PASS ${passed} checks; native PostgreSQL 17; synthetic Unix socket only; no providers`);
} finally {
 await Promise.all([a?.end({timeout:1}),b?.end({timeout:1}),c?.end({timeout:1})]);
 if(started)run('pg_ctl',['-D',`${dir}/data`,'-m','immediate','-w','stop']);
 rmSync(dir,{recursive:true,force:true});
}
