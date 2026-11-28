import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/candidats/actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(fail){let refresh=0;const filters=[];const q={delete(){return this},eq(k,v){filters.push([k,v]);return this},then(ok,bad){return Promise.resolve({error:fail?{message:'offline'}:null}).then(ok,bad)}};const mocks={'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>q})},'./session':{getCurrentFigurant:async()=>({id:'fixture'})},'next/cache':{revalidatePath:()=>refresh++}};const out={};new Function('require','exports',code)(n=>mocks[n]??{},out);return{run:()=>out.removeIndisponibiliteSelf('2026-11-15'),filters,refresh:()=>refresh}}
test('failed removal does not report success or refresh',async()=>{const f=fixture(true);const r=await f.run();assert.ok(r.error);assert.equal(f.refresh(),0)});
test('successful removal is scoped to the candidate and refreshes',async()=>{const f=fixture(false);const r=await f.run();assert.equal(r.success,true);assert.deepEqual(f.filters,[['figurant_id','fixture'],['date','2026-11-15']]);assert.equal(f.refresh(),1)});
