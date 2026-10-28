import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/messages/envois-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
test('deleting a group message reports database failure',async()=>{const refresh=[];const db={from(){return{select(){return this},eq(){return this},delete(){return this},maybeSingle(){return Promise.resolve({data:{projet_id:'project'},error:null})},then(ok,bad){return Promise.resolve({error:{message:'offline'}}).then(ok,bad)}}}};const exports={};new Function('require','exports',code)(n=>n==='@/lib/supabase/admin'?{createAdminClient:()=>db}:n==='@/lib/auth/session'?{checkProjetAccess:async()=>null}:n==='next/cache'?{revalidatePath:p=>refresh.push(p)}:{},exports);assert.ok((await exports.supprimerEnvoi('send')).error);assert.equal(refresh.length,0)});
