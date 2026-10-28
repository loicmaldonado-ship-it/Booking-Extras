import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/documents/photos-projet.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
test('project photo list excludes other projects while retaining account and current project photos',async()=>{
 const photo=(id,projet_id,type='portrait')=>({id,projet_id,type,url:'https://test.invalid/image',created_at:'2026-01-01'});
 const db={from(table){return{select(){return this},eq(){return this},in(){return this},order(){return Promise.resolve({data:table==='candidatures'?[{id:'c',figurant_id:'person'}]:[],error:null})},then(ok,bad){return Promise.resolve({data:[],error:null}).then(ok,bad)}}}};
 const mocks={'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/documents/data':{getPhotosByFigurantId:async()=>new Map([['person',[photo('global',null),photo('own','project','tenue'),photo('other','foreign')]]]),getPhotosParCandidature:async()=>new Map([['c',[photo('candidate-other','foreign'),photo('candidate-own','project')]]])}};
 const exports={};new Function('require','exports',code)(n=>mocks[n]??{},exports);const result=await exports.getPhotosProjet('project',['person']);const detail=result.get('person');const ids=[...detail.compte,...detail.essayage,...detail.candidature].map(p=>p.id);assert.ok(ids.includes('global'));assert.ok(ids.includes('own'));assert.ok(ids.includes('candidate-own'));assert.equal(ids.includes('other'),false);assert.equal(ids.includes('candidate-other'),false);
});
