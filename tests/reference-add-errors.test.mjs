import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import ts from 'typescript';
globalThis.crypto ??= webcrypto;
const code=ts.transpileModule(readFileSync(new URL('../src/lib/references/actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(kind){let refresh=0,uploads=0,removed=0,inserts=0;const db={from(){let op='read';const q={select(){return this},order(){return this},limit(){return this},insert(){op='insert';inserts++;return this},async maybeSingle(){return kind==='read'?{data:null,error:{message:'offline'}}:{data:{ordre:3},error:null}},then(ok,bad){return Promise.resolve({error:op==='insert'&&kind==='write'?{message:'offline'}:null}).then(ok,bad)}};return q},storage:{from:()=>({async upload(){uploads++;return{error:null}},async remove(){removed++;return{error:null}}})}};const mocks={'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/auth/session':{getCurrentProfile:async()=>({id:'owner'})},'@/lib/auth/owner':{isOwner:()=>true},'@/lib/media/validate-upload':{validateImageUpload:async()=>({extension:'jpg',mimeType:'image/jpeg'})},'./types':{REFERENCE_TYPES:[{value:'film'}]},'next/cache':{revalidatePath:()=>refresh++}};const out={};new Function('require','exports',code)(n=>mocks[n]??{},out);const fd=new FormData();fd.set('titre','Test fictif');fd.set('affiche',new File(['fake'],'fake.jpg',{type:'image/jpeg'}));return{run:()=>out.ajouterReference(null,fd),refresh:()=>refresh,uploads:()=>uploads,removed:()=>removed,inserts:()=>inserts}}
test('failed order lookup stops before upload or insertion',async()=>{const f=fixture('read');assert.ok((await f.run()).error);assert.equal(f.uploads(),0);assert.equal(f.inserts(),0)});
test('uncertain insertion preserves its uploaded file and reports failure',async()=>{const f=fixture('write');assert.ok((await f.run()).error);assert.equal(f.removed(),0);assert.equal(f.refresh(),0)});
test('successful creation refreshes pages',async()=>{const f=fixture();assert.equal((await f.run()).success,true);assert.equal(f.refresh(),2)});
