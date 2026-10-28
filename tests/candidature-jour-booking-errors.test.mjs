import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/lib/candidatures/jours.ts', import.meta.url),'utf8');
const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(failure) {
  const writes=[], refresh=[];
  const db={from(table){let op='select', columns=''; const q={
    select(c){columns=c;return this}, eq(){return this},in(){return this},
    upsert(){op='upsert';writes.push(table);return this},insert(){op='insert';writes.push(table);return this},update(){op='update';writes.push(table);return this},
    maybeSingle(){return Promise.resolve({data:{annonce_id:'annonce',date:'2026-11-01',annonces:{projet_id:'projet'}},error:null})},
    then(ok,bad){let key=table==='bookings' && op==='select' ? columns : table+':'+op;
      const error=key===failure?{message:'database unavailable'}:null;
      let data=table==='candidatures'?[{id:'candidate',figurant_id:'person',annonce_id:'annonce'}]:[];
      return Promise.resolve({data:error?null:data,error}).then(ok,bad)
    }};return q}};
  const exports={};runInNewContext(compiled,{exports,require(name){if(name==='@/lib/supabase/admin')return{createAdminClient:()=>db};if(name==='@/lib/auth/session')return{checkProjetAccess:async()=>null};if(name==='next/cache')return{revalidatePath:p=>refresh.push(p)};return {}}});
  return {action:exports.envoyerCandidaturesDansJour,writes,refresh};
}
for (const failure of ['figurant_id','candidature_id','journees:upsert']) {
  test(`booking aborts on ${failure} failure`,async()=>{
    const f=fixture(failure);const result=await f.action('date',['candidate'],'','cachet');
    assert.ok(result.error);assert.equal(f.writes.includes('bookings'),false);assert.equal(f.refresh.length,0);
  });
}
test('successful booking preserves normal result',async()=>{
  const f=fixture(null);const result=await f.action('date',['candidate'],'','cachet');
  assert.equal(result.ok,1);assert.equal(result.error,undefined);assert.ok(f.writes.includes('bookings'));
});

test('profile failure reports bookings already created and refreshes affected views',async()=>{
  const f=fixture('figurants:update');const result=await f.action('date',['candidate'],'','cachet');
  assert.equal(result.ok,1);assert.match(result.error,/booking.*créé/i);
  assert.ok(f.refresh.includes('/bookings/planning'));
});
