/** Disposable native PG17 only; no credentials, TCP, provider or hosted database. */
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const bin='/tmp/mn-pg17-build/runtime/bin';
const root=mkdtempSync('/tmp/mn1655-map-native-');
const data=`${root}/data`,socket=`${root}/socket`;
mkdirSync(socket,{mode:0o700});
const env={PATH:`${bin}:/usr/bin:/bin`,LANG:'C',LC_ALL:'C',TMPDIR:root};
const run=(name,args)=>{
 const r=spawnSync(`${bin}/${name}`,args,{env,encoding:'utf8'});
 if(r.status!==0)throw new Error(`${name}: ${r.stderr}`);
 return r.stdout;
};
let started=false;
try {
 assert.match(run('postgres',['--version']),/PostgreSQL\) 17\./);
 run('initdb',['-D',data,'-U','fixture_admin','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
 started=true;
 run('pg_ctl',['-D',data,'-l',`${root}/server.log`,'-o',`-c listen_addresses='' -c unix_socket_directories=${socket} -c unix_socket_permissions=0700 -p 6546`,'-w','start']);
 const identity=run('psql',['-XAt','-h',socket,'-p','6546','-U','fixture_admin','-d','postgres','-c',"select current_setting('data_directory')||'|'||current_setting('listen_addresses')"]);
 const [observed,listen]=identity.trim().split("|");
 assert.equal(realpathSync(observed),realpathSync(data));assert.equal(listen,"");
 run('psql',['-X','-h',socket,'-p','6546','-U','fixture_admin','-d','postgres','-c',"comment on database postgres is 'mn1655-target-fixture-only'"]);
 const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','docs/prototypes/guarded-about/productionMapCutover.test.ts'],{env:{...env,MN_1655_TARGET_SOCKET:socket},encoding:'utf8'});
 process.stdout.write(result.stdout);process.stderr.write(result.stderr);
 if(result.status!==0)throw new Error('Native target tests failed');
} finally {
 if(started)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);
 rmSync(root,{recursive:true,force:true});
}
