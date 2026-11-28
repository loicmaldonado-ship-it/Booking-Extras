import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../src/lib/annonces/actions.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(failure){
 const writes=[],refresh=[];
 const db={from(){let op='select';return {select(){return this},eq(){return this},delete(){op='delete';writes.push(op);return this},update(){op='update';writes.push(op);return this},maybeSingle(){return Promise.resolve(failure==='read'?{data:null,error:{message:'offline'}}:{data:{projet_id:'project'},error:null})},then(ok,bad){return Promise.resolve({error:failure===op?{message:'offline'}:null}).then(ok,bad)}}}};
 const exports={};runInNewContext(compiled,{exports,require(n){if(n==='@/lib/supabase/admin')return{createAdminClient:()=>db};if(n==='@/lib/auth/session')return{checkProjetAccess:async()=>null};if(n==='./affiche')return {normalizeAfficheCouleur:x=>x,normalizeAffichePolice:x=>x,normalizeAffichePoliceCorps:x=>x,normalizeAfficheTaille:x=>x};if(n==='next/cache')return{revalidatePath:p=>refresh.push(p)};if(n==='next/navigation')return{redirect:()=>{throw Error('redirect')}};return {}}});
 return {actions:exports,writes,refresh};
}
for(const [name,operation] of [['deleteAnnonce','delete'],['toggleAnnonceStatut','update']]){
 test(`${name} refuses to write when project lookup fails`,async()=>{const f=fixture('read');await assert.rejects(f.actions[name]('id','ouverte'));assert.equal(f.writes.length,0);assert.equal(f.refresh.length,0)});
 test(`${name} reports database write failure without revalidation`,async()=>{const f=fixture(operation);await assert.rejects(f.actions[name]('id','ouverte'),/impossible/i);assert.equal(f.refresh.length,0)});
}
test('updateAnnonce refuses to write when the existing project cannot be verified',async()=>{
 const f=fixture('read');const form=new FormData();form.set('projet_id','project');form.set('titre','Test');
 const result=await f.actions.updateAnnonce('id',null,form);assert.match(result.error,/impossible/i);assert.equal(f.writes.length,0);assert.equal(f.refresh.length,0);
});
