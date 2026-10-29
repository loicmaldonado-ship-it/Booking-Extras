import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
globalThis.crypto ??= webcrypto;
const code=ts.transpileModule(readFileSync(new URL('../src/lib/auth/avatar-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(kind){let refresh=0,remove=0;const q={update(){return this},eq(){return this},select(){return this},async maybeSingle(){return kind==='missing'?{data:null,error:null}:kind==='error'?{data:null,error:{message:'offline'}}:{data:{id:'profile'},error:null}},then(ok,bad){return Promise.resolve({error:kind==='error'?{message:'offline'}:null}).then(ok,bad)}};const db={from:()=>q,storage:{from:()=>({async upload(){return{error:null}},async remove(){remove++;return{error:null}}})}};const mocks={'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/auth/session':{getCurrentProfile:async()=>({id:'profile'})},'@/lib/media/validate-upload':{validateImageUpload:async()=>({extension:'jpg',mimeType:'image/jpeg'})},'next/cache':{revalidatePath:()=>refresh++}};const out={};new Function('require','exports',code)(n=>mocks[n]??{},out);const form=new FormData();form.set('avatar',new File(['fake'],'fake.jpg',{type:'image/jpeg'}));return{run:()=>out.updateMyAvatar(null,form),refresh:()=>refresh,remove:()=>remove}}
for(const kind of ['missing','error']) test(`avatar ${kind} does not claim success or delete an ambiguously linked file`,async()=>{const f=fixture(kind);const r=await f.run();assert.ok(r.error);assert.equal(f.refresh(),0);assert.equal(f.remove(),0)});
test('avatar update succeeds only on confirmed row',async()=>{const f=fixture('success');const r=await f.run();assert.equal(r.success,true);assert.equal(f.refresh(),1);assert.equal(f.remove(),0)});
