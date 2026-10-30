import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/candidats/rate-limit.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(kind){let calls=0;const mocks={'next/headers':{headers:async()=>new Headers()},'@/lib/supabase/admin':{createAdminClient:()=>({rpc:async()=>{calls++;return kind==='error'?{data:null,error:{message:'offline'}}:{data:kind==='allow',error:null}}})},'./auth-attempt-keys':{trustedAuthIp:()=> 'unattributed',authAttemptKeys:()=>({p_account_hash:'fake',p_ip_hash:'fake',p_pair_hash:'fake'})}};const out={};new Function('require','exports','process',code)(n=>mocks[n]??{},out,{env:kind==='no-secret'?{}:{AUTH_RATE_LIMIT_SECRET:'fake-secret'}});return{run:(email='fake@example.test')=>out.consumeCandidateLoginAttempt(email),calls:()=>calls}}
for(const kind of ['error','deny','no-secret'])test(`${kind} refuses a candidate login attempt`,async()=>{const f=fixture(kind);assert.equal(await f.run(),false);if(kind==='no-secret')assert.equal(f.calls(),0)});
test('oversized email is rejected before a database request',async()=>{const f=fixture('allow');assert.equal(await f.run('x'.repeat(255)),false);assert.equal(f.calls(),0)});
test('only an explicit database approval permits the attempt',async()=>{const f=fixture('allow');assert.equal(await f.run(),true);assert.equal(f.calls(),1)});
