import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/candidatures/jours.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
test('a candidature can be booked on two planned dates without losing either date',async()=>{
 const planned=['date1','date2'], bookings=[], mutations=[]; let sent=false;
 const db={from(table){let op='select',columns='',filter={};const q={
 select(c){columns=c;return this},eq(k,v){filter[k]=v;return this},in(){return this},upsert(){op='upsert';mutations.push([table,op]);return this},update(){op='update';mutations.push([table,op]);return this},delete(){op='delete';mutations.push([table,op]);return this},insert(rows){op='insert';mutations.push([table,op]);if(table==='bookings'){bookings.push(...rows);sent=true}return this},
 maybeSingle(){return Promise.resolve({data:{date:filter.id==='date1'?'2026-11-11':'2026-11-12',annonce_id:'annonce',annonces:{projet_id:'project'}},error:null})},
 then(ok,bad){let data=[];if(table==='candidatures')data=[{id:'candidate',figurant_id:'person',annonce_id:'annonce'}];if(table==='bookings'&&op==='select')data=columns==='figurant_id'?bookings.filter(b=>b.date===filter.date).map(b=>({figurant_id:b.figurant_id})):bookings.filter(b=>b.candidature_id).map(b=>({candidature_id:b.candidature_id}));return Promise.resolve({data,error:null}).then(ok,bad)}};return q}};
 const exports={};runInNewContext(compiled,{exports,require(n){if(n==='@/lib/supabase/admin')return{createAdminClient:()=>db};if(n==='@/lib/auth/session')return{checkProjetAccess:async()=>null};if(n==='next/cache')return{revalidatePath:()=>{}};return {}}});
 const first=await exports.envoyerCandidaturesDansJour('date1',['candidate'],'','figurant');assert.equal(first.ok,1);assert.equal(sent,true);
 const second=await exports.envoyerCandidaturesDansJour('date2',['candidate'],'','figurant');assert.equal(second.ok,1);assert.equal(bookings.length,2);assert.deepEqual(bookings.map(b=>b.date),['2026-11-11','2026-11-12']);assert.equal(bookings[0].candidature_id,'candidate');assert.equal(bookings[1].candidature_id,null);assert.deepEqual(planned,['date1','date2']);assert.equal(mutations.some(([table])=>table==='candidature_jours'),false);
});
