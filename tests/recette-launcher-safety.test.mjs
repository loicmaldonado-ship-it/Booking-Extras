import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const posixTest=process.platform==='win32'?test.skip:test;
const launcher=readFileSync(new URL('../scripts/recette-local.mjs',import.meta.url),'utf8');
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'booking-recette-test-'));const bin=join(root,'bin');mkdirSync(bin);
 mkdirSync(join(root,'scripts'));mkdirSync(join(root,'supabase/migrations'),{recursive:true});
 writeFileSync(join(root,'scripts/recette-local.mjs'),launcher);writeFileSync(join(root,'supabase/config.toml'),'project_id = "SOURCE"\n[api]\nport = 54321\n');
 writeFileSync(join(root,'supabase/seed.sql'),'select 1;');writeFileSync(join(root,'supabase/migrations/001.sql'),'select 1;');
 writeFileSync(join(root,'package-lock.json'),'{}');
 const log=join(root,'commands.log');
 for(const name of ['docker','npm','npx']){
  const body='#!/bin/sh\nprintf "%s\\n" "'+name+' $*" >> "$RECETTE_TEST_LOG"\n'+(name==='npx'?'if [ "$3" = "status" ]; then printf "%s" "$RECETTE_FAKE_STATUS"; fi\n':'')+'exit 0\n';
  writeFileSync(join(bin,name),body,{mode:0o755});
 }
 const env={...process.env,PATH:bin+':'+process.env.PATH,RECETTE_TEST_LOG:log,RECETTE_FAKE_STATUS:JSON.stringify({API_URL:'https://production.example.test',ANON_KEY:'fixture-anon',SERVICE_ROLE_KEY:'fixture-service'})};
 const run=(args=[],extra={})=>spawnSync(process.execPath,[join(root,'scripts/recette-local.mjs'),...args],{cwd:root,env:{...env,...extra},encoding:'utf8',timeout:15000});
 return {root,run,commands:()=>existsSync(log)?readFileSync(log,'utf8'):'',cleanup:()=>rmSync(root,{recursive:true,force:true})};
}
posixTest('recipe launcher preserves an existing personal environment before starting a database',()=>{
 const f=fixture();try{writeFileSync(join(f.root,'.env.local'),'PERSONAL_CONFIGURATION=fixture\n');const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/configuration personnelle/);assert.equal(readFileSync(join(f.root,'.env.local'),'utf8'),'PERSONAL_CONFIGURATION=fixture\n');assert.ok(!f.commands().includes(' start'));}finally{f.cleanup();}
});
posixTest('recipe launcher refuses a non-loopback status without creating app credentials or installing dependencies',()=>{
 const f=fixture();try{const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/n’est pas locale/);assert.ok(!existsSync(join(f.root,'.env.local')));assert.ok(!f.commands().includes('npm ci'));assert.ok(!f.commands().includes(' reset'));assert.ok(!f.commands().includes(' push'));}finally{f.cleanup();}
});
posixTest('recipe launcher refuses a schema change in an existing copy without a reset',()=>{
 const f=fixture();try{mkdirSync(join(f.root,'.recette'));writeFileSync(join(f.root,'.recette/schema.sha256'),'previous-schema');const r=f.run();assert.notEqual(r.status,0);assert.match(r.stderr,/nouvelle version du schéma/);assert.ok(!f.commands().includes('npx'));assert.equal(readFileSync(join(f.root,'.recette/schema.sha256'),'utf8'),'previous-schema');}finally{f.cleanup();}
});
posixTest('recipe stop refuses a project outside its own local namespace',()=>{
 const f=fixture();try{mkdirSync(join(f.root,'.recette/supabase'),{recursive:true});writeFileSync(join(f.root,'.recette/supabase/config.toml'),'project_id = "production"');const r=f.run(['--stop']);assert.notEqual(r.status,0);assert.equal(f.commands(),'');}finally{f.cleanup();}
});
posixTest('recipe stop only stops its own stack and preserves data',()=>{
 const f=fixture();try{mkdirSync(join(f.root,'.recette/supabase'),{recursive:true});writeFileSync(join(f.root,'.recette/supabase/config.toml'),'project_id = "BOOKING_EXTRAS_RECETTE_012345abcdef"');const r=f.run(['--stop']);assert.equal(r.status,0,r.stderr);assert.match(f.commands(),/supabase@2.122.0 stop/);assert.ok(!f.commands().includes('--no-backup'));assert.ok(!f.commands().includes(' reset'));}finally{f.cleanup();}
});
posixTest('different schema versions receive different local project identities',()=>{
 const a=fixture(),b=fixture();try{writeFileSync(join(b.root,'supabase/migrations/001.sql'),'select 2;');a.run();b.run();const config=f=>readFileSync(join(f.root,'.recette/supabase/config.toml'),'utf8').match(/project_id = "([^"]+)"/)[1];assert.notEqual(config(a),config(b));assert.match(config(a),/^BOOKING_EXTRAS_RECETTE_[a-f0-9]{12}$/);}finally{a.cleanup();b.cleanup();}
});
posixTest('local app startup forces test mode and local credentials despite inherited environment values',()=>{
 const f=fixture();try{
  mkdirSync(join(f.root,'node_modules/next/dist/bin'),{recursive:true});
  writeFileSync(join(f.root,'node_modules/next/dist/bin/next'),"if(process.env.BOOKING_TEST_MODE!=='1'||process.env.NEXT_PUBLIC_SUPABASE_URL!=='http://127.0.0.1:29194')process.exit(2);console.log('APP_TEST_MODE_CONFIRMED');");
  mkdirSync(join(f.root,'.recette'));writeFileSync(join(f.root,'.recette/dependencies.sha256'),createHash('sha256').update('{}').digest('hex'));
  const r=f.run([],{BOOKING_TEST_MODE:'0',NEXT_PUBLIC_SUPABASE_URL:'https://production.example.test',RECETTE_FAKE_STATUS:JSON.stringify({API_URL:'http://127.0.0.1:29194',ANON_KEY:'fixture-anon',SERVICE_ROLE_KEY:'fixture-service'})});
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/APP_TEST_MODE_CONFIRMED/);
  assert.match(readFileSync(join(f.root,'.env.local'),'utf8'),/^BOOKING_TEST_MODE=1$/m);assert.equal(statSync(join(f.root,'.env.local')).mode&0o777,0o600);
 }finally{f.cleanup();}
});
