import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/candidats/mot-de-passe.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
test('account lookup failure does not report that a candidate has no account',async()=>{const q={select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:{message:'offline'}})};const exports={};new Function('require','exports',code)(n=>n==='@/lib/supabase/admin'?{createAdminClient:()=>({from:()=>q})}:{},exports);await assert.rejects(exports.aCreeSonCompte('person'),/impossible/i)});
