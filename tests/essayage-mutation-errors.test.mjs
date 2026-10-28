import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require=createRequire(import.meta.url), ts=require('typescript');
const source=readFileSync(new URL('../src/lib/essayages/actions.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(failure){
 const writes=[],refresh=[];
 const db={from(table){let op='select';return {select(){return this},eq(){return this},update(){op='update';writes.push(table);return this},delete(){op='delete';writes.push(table);return this},maybeSingle(){return Promise.resolve(failure==='read'?{data:null,error:{message:'offline'}}:{data:{projet_id:'project',numero_costume:'A01',figurant_id:'person'},error:null})},then(ok,bad){return Promise.resolve({error:failure===op?{message:'offline'}:null}).then(ok,bad)}}}};
 const exports={};runInNewContext(compiled,{exports,require(n){if(n==='@/lib/supabase/admin')return{createAdminClient:()=>db};if(n==='@/lib/auth/session')return{checkProjetAccess:async()=>null};if(n==='next/cache')return{revalidatePath:p=>refresh.push(p)};return {}}});return {actions:exports,writes,refresh};
}
for(const [name,op,arg] of [['updateEssayageStatutInline','update','fait'],['updateEssayageReponseRecue','update',true],['removeEssayageFromJournee','delete',undefined]]){
 test(`${name} returns an error and does not refresh when its write fails`,async()=>{const f=fixture(op);const result=await f.actions[name]('id',arg);assert.match(result?.error,/impossible/i);assert.equal(f.refresh.length,0)});
 test(`${name} refuses to write if access cannot be checked`,async()=>{const f=fixture('read');const result=await f.actions[name]('id',arg);assert.ok(result?.error);assert.equal(f.writes.length,0)});
}
