import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/messages/envois-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(failure){const writes=[];const db={from(table){let op='read';const q={select(){return this},eq(){return this},in(){return this},update(){op='write';writes.push(table);return this},maybeSingle(){return Promise.resolve({data:{projet_id:'project'},error:null})},then(ok,bad){return Promise.resolve({data:failure==='missing'?[]:[{id:'recipient',relances:1}],error:(failure==='read'&&op==='read')||(failure==='write'&&op==='write')?{message:'offline'}:null}).then(ok,bad)}};return q}};const exports={};new Function('require','exports',code)(n=>n==='@/lib/supabase/admin'?{createAdminClient:()=>db}:n==='@/lib/auth/session'?{checkProjetAccess:async()=>null}:n==='next/cache'?{revalidatePath:()=>{}}:{},exports);return{action:exports.marquerEnvoiTextos,writes}}
for(const failure of ['read','missing','write'])test(`SMS reminder tracking reports ${failure} failure`,async()=>{const f=fixture(failure);const r=await f.action('envoi',['recipient'],true);assert.ok(r.error);if(failure!=='write')assert.equal(f.writes.length,0)});
test('SMS initial tracking reports write failure',async()=>{const f=fixture('write');assert.ok((await f.action('envoi',['recipient'],false)).error)});
