import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/casting-presentiel/actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(failure){let writes=0;const db={from(){let op='read';const q={select(){return this},in(){return this},update(){op='write';writes++;return this},then(ok,bad){return Promise.resolve({data:failure==='missing'?[]:[{id:'entry',projet_id:'project'}],error:failure==='read'&&op==='read'?{message:'offline'}:null}).then(ok,bad)}};return q}};const exports={};new Function('require','exports',code)(n=>n==='@/lib/supabase/admin'?{createAdminClient:()=>db}:n==='@/lib/auth/session'?{checkProjetAccess:async()=>null}:n==='next/cache'?{revalidatePath:()=>{}}:{},exports);return{action:exports.updatePresentielStatutBulk,writes:()=>writes}}
for(const failure of ['read','missing'])test(`bulk casting update rejects ${failure} selection`,async()=>{const f=fixture(failure);const r=await f.action(['entry'],'confirmé');assert.ok(r.error);assert.equal(f.writes(),0)});
test('bulk casting update rejects duplicate IDs',async()=>{const f=fixture();const r=await f.action(['entry','entry'],'confirmé');assert.ok(r.error);assert.equal(f.writes(),0)});
test('bulk casting update accepts a verified selection',async()=>{const f=fixture();const r=await f.action(['entry'],'confirmé');assert.equal(r.ok,1);assert.equal(f.writes(),1)});
