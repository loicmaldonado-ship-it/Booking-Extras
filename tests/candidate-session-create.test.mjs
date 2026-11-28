import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const actual=createRequire(import.meta.url);
const code=ts.transpileModule(readFileSync(new URL('../src/lib/candidats/session.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(kind){const rows=[],cookies=[],events=[];const mocks={'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>({async insert(row){rows.push(row);events.push('insert');return{error:kind==='db-error'?{message:'offline'}:null}}})})},'next/headers':{cookies:async()=>({set(...args){cookies.push(args);events.push('cookie')}})},crypto:actual('node:crypto')};const out={};new Function('require','exports','process',code)(n=>mocks[n]??{},out,{env:{NODE_ENV:kind==='production'?'production':'development'}});return{run:()=>out.createFigurantSession('candidate-a'),rows,cookies,events}}
test('a session is stored before setting a secure production cookie with matching expiry',async()=>{const f=fixture('production');const before=Date.now();await f.run();assert.equal(f.rows.length,1);assert.equal(f.cookies.length,1);assert.deepEqual(f.events,['insert','cookie']);const [name,token,opts]=f.cookies[0];assert.equal(name,'figurant_session');assert.match(token,/^[0-9a-f]{32}$/);assert.equal(token,f.rows[0].token);assert.equal(f.rows[0].figurant_id,'candidate-a');assert.equal(opts.httpOnly,true);assert.equal(opts.sameSite,'lax');assert.equal(opts.secure,true);assert.equal(opts.path,'/');assert.equal(opts.expires.toISOString(),f.rows[0].expires_at);assert.ok(opts.expires.getTime()-before>=7*24*60*60*1000)});
test('failed session insertion never sets a cookie',async()=>{const f=fixture('db-error');await assert.rejects(f.run(),/session candidat/);assert.equal(f.cookies.length,0)});
