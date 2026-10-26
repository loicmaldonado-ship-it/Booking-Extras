import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {authAttemptKeys,trustedAuthIp} from '../src/lib/candidats/auth-attempt-keys.ts';
const require=createRequire(import.meta.url);
function load(path,mocks){
 const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports',code)(name=>name in mocks?mocks[name]:require(name),exports);return exports;
}
test('auth keys normalize the account and separate account, IP and pair without storing their values',()=>{
 const a=authAttemptKeys(' Test@Example.test ','192.0.2.1','secret');
 assert.deepEqual(a,authAttemptKeys('test@example.test','192.0.2.1','secret'));
 assert.equal(new Set(Object.values(a)).size,3);
 assert.ok(Object.values(a).every(v=>/^[a-f0-9]{64}$/.test(v)));
 const b=authAttemptKeys('test@example.test','192.0.2.2','secret');
 assert.equal(a.p_account_hash,b.p_account_hash);assert.notEqual(a.p_ip_hash,b.p_ip_hash);
 assert.notDeepEqual(a,authAttemptKeys('test@example.test','192.0.2.1','other secret'));
});
test('client supplied proxy headers cannot bypass a local or unknown proxy quota',()=>{
 assert.equal(trustedAuthIp(new Headers({'x-forwarded-for':'192.0.2.1','x-vercel-forwarded-for':'192.0.2.2'}),false),'unattributed');
 assert.equal(trustedAuthIp(new Headers({'x-forwarded-for':'192.0.2.1'}),true),'unattributed');
 assert.equal(trustedAuthIp(new Headers({'x-vercel-forwarded-for':'bad,192.0.2.1'}),true),'unattributed');
 assert.equal(trustedAuthIp(new Headers({'x-vercel-forwarded-for':'192.0.2.1'}),true),'192.0.2.1');
 assert.equal(trustedAuthIp(new Headers({'x-vercel-forwarded-for':'2001:0db8::1'}),true),trustedAuthIp(new Headers({'x-vercel-forwarded-for':'2001:db8::1'}),true));
});
test('staff auth confirmation rejects external redirect_to after a valid exchange',async()=>{
 const safe=load('src/lib/auth/safe-next.ts',{});
 const {GET}=load('src/app/auth/confirm/route.ts',{
  'next/server':{NextResponse:{redirect:u=>String(u)}},
  '@/lib/auth/safe-next':safe,
  '@/lib/supabase/server':{createServerSupabaseClient:async()=>({auth:{exchangeCodeForSession:async()=>({error:null})}})},
 });
 for(const target of ['https://evil.example','//evil.example','/\\evil.example']){
  const requestUrl=new URL('http://localhost/auth/confirm');requestUrl.searchParams.set('code','fixture');requestUrl.searchParams.set('redirect_to',target);
  const result=await GET({url:requestUrl.href,nextUrl:requestUrl});assert.equal(new URL(result).origin,'http://localhost');
 }
 const requestUrl=new URL('http://localhost/auth/confirm?code=fixture&redirect_to=%2Fauth%2Freset-password');
 assert.equal(new URL(await GET({url:requestUrl.href,nextUrl:requestUrl})).pathname,'/auth/reset-password');
});
test('unknown candidate password still performs a scrypt comparison',async()=>{
 let compared=0;
 const {motDePasseCorrect}=load('src/lib/candidats/mot-de-passe.ts',{
  'server-only':{},
  '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null})})})},
  '@/lib/candidats/password':{verifyPassword:async(_pwd,hash)=>{compared++;assert.match(hash,/^[a-f0-9]{32}:[a-f0-9]{128}$/);return true;}},
 });
 assert.equal(await motDePasseCorrect('unknown','password'),false);assert.equal(compared,1);
});
