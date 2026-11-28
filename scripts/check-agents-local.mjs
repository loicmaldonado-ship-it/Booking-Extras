import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);assert.equal(process.env.BOOKING_TEST_MODE,'1');assert.equal(url.protocol,'http:');assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
const options={auth:{persistSession:false,autoRefreshToken:false}};
const db=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,options),staff=createClient(url.href,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);
const ok=r=>{assert.ifError(r.error);return r.data;};
const session=ok(await staff.auth.signInWithPassword({email:'assistante.test@test-chat-charge.fr',password:'booking-test'}));
const profile=ok(await staff.from('profiles').select('id,is_owner').eq('id',session.user.id).single());assert.equal(profile.is_owner,false);
let actor={id:profile.id,isOwner:profile.is_owner};let adminCalls=0;
const mocks={'next/cache':{revalidatePath:()=>{}},'@/lib/supabase/admin':{createAdminClient:()=>{adminCalls++;return db;}},'@/lib/auth/session':{getCurrentProfile:async()=>actor},'@/lib/auth/owner':{isOwner:p=>!!p?.isOwner}};
const code=ts.transpileModule(readFileSync(new URL('../src/lib/agents/actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const actions={};new Function('require','exports',code)(name=>{assert.ok(name in mocks,name);return mocks[name];},actions);
const marker='agent-'+randomUUID(),original={nom:marker+'Xnom',email:marker+'Xmail@example.test',agence:'Original fictif'},literal={nom:marker+'_nom',email:marker+'_mail@example.test',agence:'Litteral fictif'};
try{
 const foreign=ok(await db.from('agents').insert(original).select('id').single());
 actor=null;assert.deepEqual(await actions.searchAgents(marker),[]);await actions.upsertAgent(literal);assert.equal(adminCalls,0);
 actor={id:profile.id,isOwner:false};const f=new FormData();f.set('nom','Denied');
 assert.deepEqual(await actions.listAgents(),[]);assert.ok((await actions.createAgent(null,f)).error);assert.ok((await actions.updateAgent(foreign.id,f)).error);assert.ok((await actions.deleteAgent(foreign.id)).error);assert.equal(adminCalls,0);
 console.log('PASS anonymous searches/upserts and assistant administrative CRUD refused before admin access');
 await actions.upsertAgent(literal);
 const retained=ok(await db.from('agents').select('nom,email,agence').eq('id',foreign.id).single());assert.deepEqual(retained,original,'Literal underscore overwrote a different agent');
 const stored=ok(await db.from('agents').select('id').eq('email',literal.email).single());assert.notEqual(stored.id,foreign.id);
 const found=await actions.searchAgents(marker+'_');assert.equal(found.length,1);assert.equal(found[0].id,stored.id,'Search underscore expanded to wildcard');
 await actions.upsertAgent({...literal,agence:'Updated fixture'});assert.equal(ok(await db.from('agents').select('id').eq('email',literal.email)).length,1);
 console.log('PASS literal underscore lookup/search preserves other agent and exact repeated upsert remains idempotent');
 for(const character of [String.fromCharCode(37),String.fromCharCode(92)]){
  const prefix=marker+character.charCodeAt(0);
  const before={nom:prefix+(character==='%'?'X':'')+'nom',agence:'Original fixture'};
  const row=ok(await db.from('agents').insert(before).select('id').single());
  const name=prefix+character+'nom';await actions.upsertAgent({nom:name,agence:'Literal fixture'});
  assert.equal(ok(await db.from('agents').select('nom').eq('id',row.id).single()).nom,before.nom);
  const search=await actions.searchAgents(prefix+character);assert.equal(search.length,1);assert.equal(search[0].nom,name);
 }
 console.log('PASS percent and backslash remain literal in name matching and autocomplete');
}finally{
 ok(await db.from('agents').delete().ilike('nom',marker+'%'));await staff.auth.signOut({scope:'local'});console.log('Cleanup only uniquely prefixed fictional agents; no messages sent');
}
