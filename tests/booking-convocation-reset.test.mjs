import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/bookings/actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const ids=['a','b'];
function fixture(scenario){let writes=0;const refresh=[];const db={from(){let op='read';return{select(){return this},in(){return this},update(){op='write';writes++;return this},then(ok,bad){const data=scenario==='missing'?[{id:'a',projet_id:'p'}]:ids.map(id=>({id,projet_id:'p'}));return Promise.resolve(op==='read'?{data:scenario==='read'?null:data,error:scenario==='read'?{message:'offline'}:null}:{error:scenario==='write'?{message:'offline'}:null}).then(ok,bad)}}}};const exports={};runInNewContext(compiled,{exports,require(n){if(n==='@/lib/supabase/admin')return{createAdminClient:()=>db};if(n==='@/lib/auth/session')return{checkProjetAccess:async()=>scenario==='denied'?'Accès refusé':null};if(n==='./bulk-guard')return{validateBookingBulkIds:v=>({ok:true,ids:v})};if(n==='next/cache')return{revalidatePath:p=>refresh.push(p)};return {}}});return {actions:exports,get writes(){return writes},refresh}}
for(const scenario of ['read','missing','denied'])test(`reset rejects ${scenario} before any write`,async()=>{const f=fixture(scenario);const r=await f.actions.resetConvocationEnvoyee(ids);assert.ok(r.error);assert.equal(f.writes,0)});
test('reset reports failed write without refresh',async()=>{const f=fixture('write');const r=await f.actions.resetConvocationEnvoyee(ids);assert.ok(r.error);assert.equal(f.refresh.length,0)});
test('reset succeeds with a fully authorized selection',async()=>{const f=fixture('ok');const r=await f.actions.resetConvocationEnvoyee(ids);assert.equal(r.success,true);assert.equal(f.writes,1)});
