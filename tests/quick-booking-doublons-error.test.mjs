import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/figurants/doublons.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
test('a failed duplicate lookup cannot be treated as an empty result',async()=>{
 const query={select(){return this},eq(){return this},ilike(){return this},limit(){return Promise.resolve({data:null,error:{message:'offline'}})}};
 const mocks={'@/lib/supabase/server':{createServerSupabaseClient:async()=>({from:()=>query})},'@/lib/candidatures/onglets-affichage':{sansAccent:s=>s.toLowerCase()},'@/lib/documents/fields':{},'@/lib/documents/data':{}};const exports={};new Function('require','exports',code)(n=>mocks[n]??{},exports);
 await assert.rejects(exports.doublonsProbables({prenom:'Test',nom:'Fictif',telephone:''}),/impossible/i);
});
