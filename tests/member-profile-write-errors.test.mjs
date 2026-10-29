import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/auth/profile-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(kind){let refresh=0;const q={update(){return this},eq(){return this},select(){return this},async maybeSingle(){return kind==='missing'?{data:null,error:null}:kind==='error'?{data:null,error:{message:'db unavailable'}}:{data:{id:'profile'},error:null}},then(ok,bad){return Promise.resolve({error:kind==='error'?{message:'db unavailable'}:null}).then(ok,bad)}};const mocks={'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>q})},'@/lib/auth/session':{getCurrentProfile:async()=>({id:'profile'})},'next/cache':{revalidatePath:()=>refresh++}};const out={};new Function('require','exports',code)(n=>mocks[n]??{},out);const form=new FormData();form.set('prenom','Test');form.set('nom','Fictif');form.set('telephone','0000000000');return{run:()=>out.updateMyProfile(null,form),refresh:()=>refresh}}
for(const kind of ['missing','error']) test(`profile ${kind} does not claim success`,async()=>{const f=fixture(kind);const r=await f.run();assert.ok(r.error);assert.equal(f.refresh(),0)});
test('profile update succeeds only on confirmed row',async()=>{const f=fixture('success');const r=await f.run();assert.equal(r.success,true);assert.equal(f.refresh(),1)});
