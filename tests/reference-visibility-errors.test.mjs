import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/references/actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(kind){let refresh=0;const q={update(){return this},eq(){return this},select(){return this},async maybeSingle(){return kind==='missing'?{data:null,error:null}:kind==='error'?{data:null,error:{message:'offline'}}:{data:{id:'fixture'},error:null}},then(ok,bad){return Promise.resolve({error:kind==='error'?{message:'offline'}:null}).then(ok,bad)}};const mocks={'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>q})},'@/lib/auth/session':{getCurrentProfile:async()=>({id:'owner'})},'@/lib/auth/owner':{isOwner:()=>true},'next/cache':{revalidatePath:()=>refresh++}};const out={};new Function('require','exports',code)(n=>mocks[n]??{},out);return{run:()=>out.basculerReferenceVisible('fixture',true),refresh:()=>refresh}}
for(const kind of ['missing','error'])test(`visibility ${kind} does not claim success`,async()=>{const f=fixture(kind);assert.ok((await f.run()).error);assert.equal(f.refresh(),0)});
test('visibility refreshes both pages after confirmed update',async()=>{const f=fixture('success');assert.equal((await f.run()).success,true);assert.equal(f.refresh(),2)});
