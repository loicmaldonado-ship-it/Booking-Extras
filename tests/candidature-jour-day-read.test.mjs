import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../src/lib/candidatures/jours.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
test('day candidate lookup failure is reported instead of an empty day',async()=>{
 const db={from(table){const q={select(){return this},eq(){return this},is(){return this},limit(){return this},maybeSingle(){return Promise.resolve({data:table==='annonce_dates'?{annonce_id:'a'}:{id:'tab'},error:null})},then(resolve,reject){return Promise.resolve({data:null,error:{message:'offline'}}).then(resolve,reject)}};return q}};
 const exports={};runInNewContext(compiled,{exports,require(n){if(n==='@/lib/supabase/admin')return{createAdminClient:()=>db};return {}}});
 const result=await exports.envoyerJourAuTournage('date','','cachet');assert.ok(result.error);
});
