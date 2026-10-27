import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
function load(path, mocks, env={}) {
  const exports={};
  const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(code,{exports,process:{env},Date,File,Buffer,console,require(name){
    if(name in mocks)return mocks[name];
    if(name==='server-only')return {};
    if(name==='crypto')return require('node:crypto');
    return new Proxy({}, {get:(_target,key)=>{if(key==='__esModule')return false;return ()=>{throw Error('Unexpected dependency '+name+':'+String(key));};}});
  }});
  return exports;
}
test('anonymous figurant mutations refuse before service-role access',async()=>{
 let reads=0;
 const a=load('src/lib/figurants/actions.ts',{
  '@/lib/auth/session':{getCurrentProfile:async()=>null},
  '@/lib/supabase/admin':{createAdminClient:()=>{reads++;throw Error('unauthorized DB');}},
 });
 for(const [name,args] of [
  ['createFigurant',[null,new FormData()]],['updateFigurant',['foreign',null,new FormData()]],
  ['updateFigurantInline',['foreign',null,new FormData()]],['updateFigurantAgent',['foreign',new FormData()]],
  ['uploadFigurantPhoto',['foreign',null,new FormData()]],['deletePhoto',['photo','foreign']],
  ['deleteLien',['link','foreign']],['mergeFigurants',['a','b']],['supprimerFigurantDoublon',['foreign','SUPPRIMER']],
 ]) {const r=await a[name](...args);assert.ok(r?.error,name);}
 assert.equal(reads,0);
});
test('foreign figurant fails RLS visibility before privileged mutation',async()=>{
 let privileged=0;
 const q={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:null,error:null})};
 const a=load('src/lib/figurants/actions.ts',{
  '@/lib/auth/session':{getCurrentProfile:async()=>({id:'staff',isOwner:false})},
  '@/lib/supabase/server':{createServerSupabaseClient:async()=>({from:()=>q})},
  '@/lib/supabase/admin':{createAdminClient:()=>{privileged++;throw Error('forbidden mutation');}},
 });
 assert.ok((await a.deleteLien('link','foreign')).error);
 assert.ok((await a.updateFigurantAgent('foreign',new FormData())).error);
 assert.equal(privileged,0);
});
function sessionHarness({token='opaque',session={figurant_id:'candidate',expires_at:new Date(Date.now()+60000).toISOString()},person={id:'candidate',prenom:'A',nom:'B',email:null,acces_compte:true,last_seen_at:new Date().toISOString()},error=null,insertError=null}={}){
 const sets=[];let table;let reads=0;
 const q={select(){return this;},eq(){return this;},maybeSingle:async()=>({data:table==='figurant_sessions'?session:person,error}),insert:async()=>({error:insertError})};
 const a=load('src/lib/candidats/session.ts',{
  'next/headers':{cookies:async()=>({get:()=>token?{value:token}:undefined,set:(...args)=>sets.push(args)})},
  '@/lib/supabase/admin':{createAdminClient:()=>{reads++;return {from:t=>{table=t;return q;}};}},
 },{NODE_ENV:'production'});
 return {a,sets,reads:()=>reads};
}
test('candidate sessions deny missing, expired, revoked and database-error credentials',async()=>{
 for(const options of [{token:null},{session:null},{session:{expires_at:new Date(0).toISOString()}},{person:{acces_compte:false}},{error:{message:'unavailable'}}]){
  assert.equal(await sessionHarness(options).a.getCurrentFigurant(),null);
 }
 assert.equal((await sessionHarness().a.getCurrentFigurant()).id,'candidate');
});
test('candidate cookie is secure and session creation failure sets no cookie',async()=>{
 const ok=sessionHarness();await ok.a.createFigurantSession('candidate');
 assert.equal(ok.sets[0][2].secure,true);assert.equal(ok.sets[0][2].httpOnly,true);assert.equal(ok.sets[0][2].sameSite,'lax');
 const failed=sessionHarness({insertError:{message:'DB unavailable'}});
 await assert.rejects(failed.a.createFigurantSession('candidate'),/Impossible/);assert.equal(failed.sets.length,0);
});
test('logout revokes the server token before clearing the cookie; DB failure prevents false success',async()=>{
 for(const fail of [false,true]){
  const events=[];
  const q={delete(){events.push('delete');return this;},eq:async(key,value)=>{assert.equal(key,'token');assert.equal(value,'opaque');return {error:fail?{}:null};}};
  const a=load('src/lib/candidats/actions.ts',{
   'next/headers':{cookies:async()=>({get:()=>({value:'opaque'})})},
   '@/lib/supabase/admin':{createAdminClient:()=>({from:t=>{assert.equal(t,'figurant_sessions');return q;}})},
   './session':{clearFigurantSessionCookie:async()=>events.push('clear')},
   'next/navigation':{redirect:()=>{events.push('redirect');throw Error('redirect');}},
  });
  await assert.rejects(a.logoutFigurant(),fail?/révoquer/:/redirect/);
  assert.deepEqual(events,fail?['delete']:['delete','clear','redirect']);
 }
});
test('all three privileged share readers deny non-members before admin reads',async()=>{
 let reads=0;
 const a=load('src/lib/partage/actions.ts',{
  '@/lib/auth/session':{checkProjetAccess:async()=> 'Accès refusé.'},
  '@/lib/supabase/admin':{createAdminClient:()=>{reads++;throw Error('forbidden read');}},
 });
 for(const [name,args] of [['getPartageToken',['foreign','casting']],['getPartageTitre',['foreign','casting']],['getJourneePartageLien',['foreign','2026-10-27']]]) await assert.rejects(a[name](...args),/Accès refusé/);
 assert.equal(reads,0);
});
test('anonymous candidate activation and revocation deny before privileged writes',async()=>{
 let writes=0;
 const a=load('src/lib/candidats/actions.ts',{
  '@/lib/auth/session':{getCurrentProfile:async()=>null},
  '@/lib/supabase/admin':{createAdminClient:()=>{writes++;throw Error('forbidden write');}},
 });
 assert.ok((await a.activerAccesCompte('foreign','foreign-project')).error);
 assert.ok((await a.toggleAccesCompte('foreign',false,'foreign-project')).error);
 assert.equal(writes,0);
});
test('authenticated staff cannot activate or revoke an invisible private profile',async()=>{
 let writes=0;
 const a=load('src/lib/candidats/actions.ts',{
  '@/lib/auth/session':{getCurrentProfile:async()=>({id:'staff',role:'chef'}),checkProjetAccess:async()=>null},
  '@/lib/auth/owner':{aAccesComplet:()=>true},
  '@/lib/figurants/access':{checkVisibleFigurants:async()=> 'Profil inaccessible.'},
  '@/lib/supabase/admin':{createAdminClient:()=>{writes++;throw Error('forbidden write');}},
 });
 assert.match((await a.activerAccesCompte('foreign','project')).error,/inaccessible/);
 assert.match((await a.toggleAccesCompte('foreign',false,'project')).error,/inaccessible/);
 assert.equal(writes,0);
});
