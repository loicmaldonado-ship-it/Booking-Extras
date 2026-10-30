import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/candidats/actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(kind){let cleared=0;const deleted=[],redirects=[];const q={delete(){return this},eq(k,v){deleted.push([k,v]);return Promise.resolve({error:kind==='error'?{message:'offline'}:null})}};const mocks={'next/headers':{cookies:async()=>({get:()=>kind==='no-cookie'?undefined:{value:'fake-token-a'}})},'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>q})},'./session':{clearFigurantSessionCookie:async()=>cleared++},'next/navigation':{redirect:url=>redirects.push(url)}};const out={};new Function('require','exports',code)(n=>mocks[n]??{},out);return{run:()=>out.logoutFigurant(),cleared:()=>cleared,deleted,redirects}}
test('logout revokes only the current token before clearing its cookie',async()=>{const f=fixture();await f.run();assert.deepEqual(f.deleted,[['token','fake-token-a']]);assert.equal(f.cleared(),1);assert.deepEqual(f.redirects,['/compte/connexion'])});
test('failed revocation does not present logout as completed',async()=>{const f=fixture('error');await assert.rejects(f.run(),/révoquer/);assert.equal(f.cleared(),0);assert.equal(f.redirects.length,0)});
test('logout without a cookie simply clears local cookie and redirects',async()=>{const f=fixture('no-cookie');await f.run();assert.equal(f.deleted.length,0);assert.equal(f.cleared(),1)});
