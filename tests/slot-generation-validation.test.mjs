import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function fixture(path,name,failure){const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;let writes=0;const db={from(){const q={select(){return this},eq(){return this},insert(){writes++;return this},maybeSingle(){return Promise.resolve({data:{projet_id:'project'},error:null})},then(ok,bad){return Promise.resolve({data:[],error:failure?{message:'offline'}:null}).then(ok,bad)}};return q}};const exports={};new Function('require','exports',code)(n=>n==='@/lib/supabase/admin'?{createAdminClient:()=>db}:n==='@/lib/auth/session'?{checkProjetAccess:async()=>null}:n==='next/cache'?{revalidatePath:()=>{}}:{},exports);return{action:exports[name],writes:()=>writes}}
function form(start='09:00',end='10:00'){const f=new FormData();f.set('heure_debut',start);f.set('heure_fin',end);f.set('duree_minutes','30');f.set('capacite','3');return f}
for(const [path,name] of [['src/lib/casting-presentiel/actions.ts','generatePresentielCreneaux'],['src/lib/essayages/actions.ts','generateCreneaux']]){
 test(`${name} rejects unreadable existing slots`,async()=>{const f=fixture(path,name,true);const r=await f.action('day',null,form());assert.ok(r.error);assert.equal(f.writes(),0)});
 test(`${name} rejects impossible times`,async()=>{const f=fixture(path,name,false);const r=await f.action('day',null,form('09:00','25:00'));assert.ok(r.error);assert.equal(f.writes(),0)});
 test(`${name} creates slots for a valid range`,async()=>{const f=fixture(path,name,false);const r=await f.action('day',null,form());assert.equal(r.count,2);assert.equal(f.writes(),1)});
}
