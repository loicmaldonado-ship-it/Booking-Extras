import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/notifications/create.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(failure){const logs=[];const db={from(){return{insert:async()=>{if(failure==='throw')throw Error('private details');return {error:failure==='write'?{message:'private details'}:null}}}}};const exports={};new Function('require','exports','console',code)(n=>n==='@/lib/supabase/admin'?{createAdminClient:()=>db}:{},exports,{error:(...args)=>logs.push(args.join(' '))});return{action:exports.createNotification,logs}}
for(const failure of ['write','throw'])test(`notification ${failure} failure is reported without private details`,async()=>{const f=fixture(failure);const r=await f.action('candidature','Private candidate name');assert.ok(r.error);assert.equal(f.logs.length,1);assert.doesNotMatch(f.logs[0],/Private candidate|private details/i)});
test('successful notification is reported',async()=>{const f=fixture();const r=await f.action('candidature','Test');assert.equal(r.error,undefined);assert.equal(f.logs.length,0)});
