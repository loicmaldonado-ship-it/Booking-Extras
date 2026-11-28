import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/lib/candidatures/jours.ts', import.meta.url),'utf8');
const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
async function run(fail, ids = ['candidate']) {
  let writes=0, revalidated=0;
  const db={from(table){let update=false; const q={select(){return this},eq(){return this},in(){return this},update(){update=true;writes++;return this},maybeSingle(){return Promise.resolve(table==='annonce_dates'?{data:{annonce_id:'a',annonces:{projet_id:'p'}}}: {data:{id:'tab',annonce_id:'a'}})},then(ok,bad){let r=update?{error:null}:table==='candidatures'?(fail==='candidate'?{data:null,error:{message:'offline'}}:{data:[{id:'candidate',onglet_id:'out'}],error:null}):{data:null,error:fail?{message:'offline'}:null};return Promise.resolve(r).then(ok,bad)}};return q}};
  const exports={}; runInNewContext(compiled,{exports,require(n){if(n==='@/lib/supabase/admin')return{createAdminClient:()=>db};if(n==='@/lib/auth/session')return{checkProjetAccess:async()=>null};if(n==='next/cache')return{revalidatePath:()=>revalidated++};return {}}});
  const result=await exports.setCandidaturesJourBulk(ids,'date',true);
  return {result,writes,revalidated};
}
test('failed protected-tab lookup never moves a candidature', async () => {
  const {result,writes,revalidated} = await run(true);
  assert.ok(result.error);
  assert.equal(writes, 0);
  assert.equal(revalidated, 0);
});

test('failed candidate lookup in day assignment is not treated as an empty result',async()=>{
 const {result,writes,revalidated}=await run('candidate');assert.ok(result.error);assert.equal(writes,0);assert.equal(revalidated,0);
});

test('day assignment rejects incomplete and oversized selections before writing',async()=>{
 for (const ids of [['candidate','other'],Array.from({length:301},(_,i)=>String(i))]) {
  const {result,writes}=await run(false,ids);assert.ok(result.error);assert.equal(writes,0);
 }
});
