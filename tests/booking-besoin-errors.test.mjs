import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/bookings/besoins-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(failure){const writes=[],refresh=[];const db={from(table){let op='read';return {select(){return this},eq(){return this},upsert(){op='upsert';writes.push(op);return this},delete(){op='delete';writes.push(op);return this},maybeSingle(){return Promise.resolve(failure===table?{data:null,error:{message:'offline'}}:{data:table==='journees'?{projet_id:'project'}:{journee_id:'day'},error:null})},then(ok,bad){return Promise.resolve({error:failure===op?{message:'offline'}:null}).then(ok,bad)}}}};const exports={};runInNewContext(compiled,{exports,require(n){if(n==='@/lib/supabase/admin')return{createAdminClient:()=>db};if(n==='@/lib/auth/session')return{checkProjetAccess:async()=>null};if(n==='next/cache')return{revalidatePath:p=>refresh.push(p)};return {}}});return {actions:exports,writes,refresh}}
test('adding a need refuses to write if the day cannot be checked',async()=>{const f=fixture('journees');const form=new FormData();form.set('fonction','Figuration');form.set('quantite','2');const r=await f.actions.addBesoin('day',null,form);assert.ok(r.error);assert.equal(f.writes.length,0)});
for(const failure of ['journee_besoins','journees'])test(`deleting a need refuses to write when ${failure} lookup fails`,async()=>{const f=fixture(failure);await assert.rejects(f.actions.deleteBesoin('id'));assert.equal(f.writes.length,0)});
test('deleting a need reports a database failure before refresh',async()=>{const f=fixture('delete');await assert.rejects(f.actions.deleteBesoin('id'),/impossible/i);assert.equal(f.refresh.length,0)});
test('renaming a need reports a booking lookup failure after the need was saved',async()=>{
 const refresh=[];const db={from(table){let op='read';const q={select(){return this},eq(){return this},not(){return this},update(){op='update';return this},maybeSingle(){return Promise.resolve({data:{journee_id:'day',fonction:'Ancien',journees:{projet_id:'project',date:'2026-11-01'}},error:null})},then(ok,bad){return Promise.resolve(table==='bookings'&&op==='read'?{data:null,error:{message:'offline'}}:{data:[],error:null}).then(ok,bad)}};return q}};
 const exports={};runInNewContext(compiled,{exports,require(n){if(n==='@/lib/supabase/admin')return{createAdminClient:()=>db};if(n==='@/lib/auth/session')return{checkProjetAccess:async()=>null};if(n==='next/cache')return{revalidatePath:p=>refresh.push(p)};return {}}});
 const result=await exports.updateBesoin('id','Nouveau',1,true);assert.match(result.error,/besoin.*enregistré/i);assert.ok(refresh.includes('/bookings/documents'));
});
