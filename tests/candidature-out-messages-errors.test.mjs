import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../src/lib/candidatures/out.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(fail){
 let writes=0;const db={from(){let op='select';const q={select(){return this},eq(){return this},is(){return this},in(){return this},delete(){op='delete';writes++;return this},insert(){op='insert';writes++;return this},maybeSingle(){return Promise.resolve(fail==='tab'?{data:null,error:{message:'offline'}}:{data:{id:'out'},error:null})},then(ok,bad){return Promise.resolve({data:[],error:fail===op?{message:'offline'}:null}).then(ok,bad)}};return q}};
 const exports={};runInNewContext(compiled,{exports,require(n){if(n==='@/lib/supabase/admin')return{createAdminClient:()=>db};if(n==='@/lib/auth/session')return{getCurrentProfile:async()=>({id:'staff'})};return {}}});return {action:exports.appliquerMessagesOut,get writes(){return writes}};
}
const row={id:'candidate',onglet_id:null,figurant_id:'person',annonces:{titre:'Test',projet_id:'project'}};
for(const fail of ['tab','select','insert'])test(`OUT message failure: ${fail}`,async()=>{const f=fixture(fail);await assert.rejects(f.action([row],'out'));if(fail!=='insert')assert.equal(f.writes,0)});
test('OUT message deletion failure is reported',async()=>{const f=fixture('delete');await assert.rejects(f.action([{...row,onglet_id:'out'}],null))});
test('OUT message insertion succeeds',async()=>{const f=fixture(null);await f.action([row],'out');assert.equal(f.writes,1)});
