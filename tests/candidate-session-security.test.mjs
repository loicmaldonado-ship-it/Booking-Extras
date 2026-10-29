import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const requireActual=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync(new URL('../src/lib/candidats/session.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(cookie,kind){const seen=[];const db={from(table){let filter;const q={select(){return this},eq(k,v){filter=[k,v];seen.push([table,k,v]);return this},async maybeSingle(){if(table==='figurant_sessions')return kind==='error'?{data:null,error:{message:'offline'}}:cookie==='valid-token'?{data:{figurant_id:'candidate-a',expires_at:kind==='expired'?'2000-01-01T00:00:00Z':'2999-01-01T00:00:00Z'},error:null}:{data:null,error:null};return{data:{id:filter[1],prenom:'Test',nom:'Fictif',email:null,last_seen_at:new Date().toISOString(),acces_compte:kind!=='revoked'},error:null}}};return q}};const mocks={'@/lib/supabase/admin':{createAdminClient:()=>db},'next/headers':{cookies:async()=>({get:()=>cookie?{value:cookie}:undefined})},'@/lib/noms':{nomComplet:()=>''},'@/lib/notifications/create':{createNotification:async()=>{}},crypto:requireActual('node:crypto')};const out={};new Function('require','exports',code)(n=>mocks[n]??{},out);return{run:()=>out.getCurrentFigurant(),seen}}
for(const [name,token,kind] of [['missing',null,'ok'],['forged','candidate-b','ok'],['expired','valid-token','expired'],['revoked','valid-token','revoked'],['database error','valid-token','error']])test(`${name} session is rejected`,async()=>{assert.equal(await fixture(token,kind).run(),null)});
test('valid session looks up the server-stored candidate identity',async()=>{const f=fixture('valid-token','ok');const r=await f.run();assert.equal(r.id,'candidate-a');assert.ok(f.seen.some(([table,key,value])=>table==='figurants'&&key==='id'&&value==='candidate-a'))});
