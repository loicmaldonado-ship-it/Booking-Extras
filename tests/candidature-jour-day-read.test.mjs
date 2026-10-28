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
 const db={from(table){const q={select(){return this},eq(){return this},is(){return this},limit(){return this},maybeSingle(){return Promise.resolve({data:table==='annonce_dates'?{annonce_id:'a',annonces:{projet_id:'p'}}:{id:'tab'},error:null})},then(resolve,reject){return Promise.resolve({data:null,error:{message:'offline'}}).then(resolve,reject)}};return q}};
 const exports={};runInNewContext(compiled,{exports,require(n){if(n==='@/lib/supabase/admin')return{createAdminClient:()=>db};if(n==='@/lib/auth/session')return{checkProjetAccess:async()=>null};return {}}});
 const result=await exports.envoyerJourAuTournage('date','','cachet');assert.ok(result.error);
});

test('project access is checked before reading any candidates even for an empty day',async()=>{
 const reads=[]; const db={from(table){reads.push(table);const q={select(){return this},eq(){return this},is(){return this},limit(){return this},maybeSingle(){return Promise.resolve({data:table==='annonce_dates'?{annonce_id:'a',annonces:{projet_id:'p'}}:{id:'tab'},error:null})},then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}};return q}};
 const exports={};runInNewContext(compiled,{exports,require(n){if(n==='@/lib/supabase/admin')return{createAdminClient:()=>db};if(n==='@/lib/auth/session')return{checkProjetAccess:async()=> 'Accès refusé'};return {}}});
 const result=await exports.envoyerJourAuTournage('date','','cachet');assert.equal(result.error,'Accès refusé');assert.equal(reads.includes('candidatures'),false);
});
