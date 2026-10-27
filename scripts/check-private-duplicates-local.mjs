import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);assert.equal(process.env.BOOKING_TEST_MODE,'1');assert.equal(url.protocol,'http:');assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,options),staff=createClient(url.href,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);
const ok=r=>{assert.ifError(r.error);return r.data;};
const auth=ok(await staff.auth.signInWithPassword({email:'assistante.test@test-chat-charge.fr',password:'booking-test'}));
const ownProject='00000000-0000-4000-8000-0000000070e0',owner='00000000-0000-4000-8000-00000000c0c0',foreignProject=randomUUID();
const people=Array.from({length:6},()=>randomUUID()), marker=randomUUID().slice(0,8),phone='0699'+String(Math.floor(Math.random()*1e6)).padStart(6,'0');
const date='2030-06-01';let calls=0;
const dayExisted=ok(await admin.from('journees').select('id').eq('projet_id',ownProject).eq('date',date)).length>0;
function load(file,mocks={}){const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const exports={};new Function('require','exports',code)(name=>{if(name==='server-only')return {};assert.ok(name in mocks,'Unexpected import '+name);return mocks[name];},exports);return exports;}
const shared={'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/supabase/server':{createServerSupabaseClient:async()=>staff}};
const duplicateModule=load('src/lib/figurants/duplicates.ts',{...shared,'./duplicate-normalization':load('src/lib/figurants/duplicate-normalization.ts')});
const fuzzy=load('src/lib/figurants/doublons.ts',{...shared,'@/lib/candidatures/onglets-affichage':load('src/lib/candidatures/onglets-affichage.ts'),'@/lib/documents/fields':load('src/lib/documents/fields.ts'),'@/lib/documents/data':{getPhotosByFigurantId:async ids=>new Map(ids.map(id=>[id,[]]))}});
const actions=load('src/lib/bookings/ajout-rapide-actions.ts',{...shared,'@/lib/minors/model':load('src/lib/minors/model.ts'),'next/cache':{revalidatePath:()=>{}},'@/lib/auth/session':{checkProjetAccess:async pid=>{const rows=ok(await staff.from('projets').select('id').eq('id',pid));return rows.length?null:'Accès refusé';}},'@/lib/figurants/photos':{insertFigurantPhoto:()=>{throw Error('Photo not used');}},'@/lib/candidats/invitation':{envoyerInvitationCompte:async()=>{calls++;return 'compte_existant';}},'@/lib/candidatures/types':load('src/lib/candidatures/types.ts'),'@/lib/figurants/doublons':fuzzy});
const authContext={'@/lib/auth/session':{checkProjetAccess:async pid=>ok(await staff.from('projets').select('id').eq('id',pid)).length?null:'Acces refuse',getCurrentProfile:async()=>({id:auth.user.id,isOwner:false})}};
const booking=load('src/lib/bookings/actions.ts',{...shared,...authContext,'@/lib/figurants/access':load('src/lib/figurants/access.ts',shared),'@/lib/noms':load('src/lib/noms.ts'),'next/cache':{revalidatePath:()=>{}},'next/navigation':{redirect:path=>{throw Object.assign(new Error('Redirect'),{redirect:path});}},'@/lib/candidats/messaging':{},'@/lib/candidats/email':{},'@/lib/candidats/mot-de-passe':{},'./drop-guard':load('src/lib/bookings/drop-guard.ts'),'./bulk-guard':load('src/lib/bookings/bulk-guard.ts',{'@/lib/candidatures/types':load('src/lib/candidatures/types.ts'),'./types':load('src/lib/bookings/types.ts')})});
const bookingForm=id=>{const f=new FormData();for(const [k,v] of Object.entries({figurant_id:id,projet_id:ownProject,date,fonction:'Figuration',cachet:'Figurant'}))f.set(k,v);return f;};
const form=id=>{const f=new FormData();for(const [k,v] of Object.entries({prenom:'Autre',nom:'Choix',email:'unmatched-'+marker+'@example.test',telephone:'0600012345',choix:'reprendre:'+id}))f.set(k,v);return f;};
try{
 ok(await admin.from('projets').insert({id:foreignProject,nom:'Private duplicates fixture',owner_id:owner}));
 const base={prenom:'Doublon'+marker,nom:'Fictif'+marker,telephone:phone,date_naissance:'1990-01-01',confirme:true,est_comedien:false};
 ok(await admin.from('figurants').insert([
  {...base,id:people[0],acces_compte:true},
  {...base,id:people[1],acces_compte:false,temporaire_projet_id:foreignProject},
  {...base,id:people[2],acces_compte:true,est_comedien:true,comedien_pool_id:owner},
  {...base,id:people[3],acces_compte:false,temporaire_projet_id:ownProject},
  {...base,id:people[4],acces_compte:true},
  {...base,id:people[5],acces_compte:false,est_comedien:true,comedien_pool_id:auth.user.id},
 ]));
 const visible=ok(await staff.from('figurants').select('id').in('id',people));assert.deepEqual(new Set(visible.map(x=>x.id)),new Set([people[0],people[3],people[4],people[5]]));
 if(!process.argv.includes('--probe-quick')){
 const duplicates=await duplicateModule.findPossibleDuplicates(people[0]);
 assert.ok(!duplicates.some(x=>[people[1],people[2]].includes(x.figurant.id)),'PRIVATE profile leaked by duplicate helper');
 assert.ok(duplicates.some(x=>x.figurant.id===people[3]));assert.ok(duplicates.some(x=>x.figurant.id===people[4]));assert.ok(duplicates.some(x=>x.figurant.id===people[5]));
 assert.deepEqual(await duplicateModule.findPossibleDuplicates(people[1]),[],'Hidden source reveals duplicates');
 console.log('PASS exact/phone duplicate helper: foreign ordinary/actor private profiles excluded; own/shared profiles preserved');
 const probable=await fuzzy.doublonsProbables({prenom:base.prenom,nom:base.nom,telephone:phone});
 assert.ok(!probable.some(x=>[people[1],people[2],people[5]].includes(x.id)));assert.ok(probable.some(x=>x.id===people[3]));assert.ok(probable.some(x=>x.id===people[4]));
 console.log('PASS fuzzy duplicates: private foreign profile excluded; local/shared normal profiles preserved; actor exclusion preserved');
 }
 for(const id of [people[1],people[2]]){
  for(const run of [()=>booking.createBooking(null,bookingForm(id)),()=>booking.createBookingFromDrop(id,ownProject,date,undefined,'Figuration','Figurant'),()=>booking.createBookingsFromDropBulk([id],ownProject,[date],undefined,'Figuration','Figurant')]){
   const result=await run();assert.ok(result.error,'Standard booking action accepted hidden person');
  }
  const direct=await staff.from('bookings').insert({figurant_id:id,projet_id:ownProject,date,fonction:'Figuration',cachet:'Figurant'});assert.equal(direct.error?.code,'42501','Direct REST insert accepted hidden person');
 }
 const normal=ok(await admin.from('bookings').insert({figurant_id:people[4],projet_id:ownProject,date,fonction:'Figuration',cachet:'Figurant'}).select('id').single());
 const changed=await booking.updateBooking(normal.id,null,bookingForm(people[1]));assert.ok(changed.error);assert.equal(ok(await admin.from('bookings').select('figurant_id').eq('id',normal.id).single()).figurant_id,people[4]);
 console.log('PASS create/edit/drop/bulk actions and direct REST refuse hidden people; original booking preserved');
 const bulkDriver=await booking.bulkUpdateBookings([normal.id],{covoiturage_conducteur_id:people[1]});assert.ok(bulkDriver.error,'Bulk hidden driver accepted');
 const privateAccess=await booking.sendEspacePersoLinkBulk([people[1]],ownProject);assert.ok(privateAccess.error,'Hidden profile activated');assert.equal(ok(await admin.from('figurants').select('acces_compte').eq('id',people[1]).single()).acces_compte,false);
 const unrelatedAccess=await booking.sendEspacePersoLinkBulk([people[0]],ownProject);assert.ok(unrelatedAccess.error,'Unrelated shared profile invited');
 console.log('PASS bulk private driver and hidden/unrelated account activation refused before transport');
 const ownActor=await booking.createBookingFromDrop(people[5],ownProject,date,undefined,'Figuration','Figurant');assert.ifError(ownActor.error);
 const ownDriver=bookingForm(people[0]);ownDriver.set('covoiturage_conducteur_id',people[1]);assert.ok((await booking.createBooking(null,ownDriver)).error,'Hidden driver accepted');
 console.log('PASS own-pool actor without account can be booked; hidden carpool driver refused');
 for(const id of [people[1],people[2]]){
 const result=await actions.ajoutRapideBooking(ownProject,date,'Figuration','Figurant',form(id));assert.ok(result.error,'Forged private profile was booked');
  assert.equal(ok(await admin.from('bookings').select('id').eq('figurant_id',id).eq('projet_id',ownProject)).length,0);
 }
 assert.equal(calls,0,'Invitation attempted for inaccessible profile');
 const result=await actions.ajoutRapideBooking(ownProject,date,'Figuration','Figurant',form(people[3]));assert.ifError(result.error);assert.equal(ok(await admin.from('bookings').select('id').eq('figurant_id',people[3]).eq('projet_id',ownProject)).length,1);assert.equal(calls,1);
 console.log('PASS quick booking: forged foreign/private ids refused without booking/invitation, visible existing profile accepted');
}finally{
 ok(await admin.from('bookings').delete().in('figurant_id',people));
 if(!dayExisted && ok(await admin.from('bookings').select('id').eq('projet_id',ownProject).eq('date',date)).length===0)ok(await admin.from('journees').delete().eq('projet_id',ownProject).eq('date',date));
 ok(await admin.from('figurants').delete().in('id',people));
 ok(await admin.from('projets').delete().eq('id',foreignProject));
 await staff.auth.signOut();
 console.log('Cleanup fictional profiles/project/bookings only; no real invitations sent');
}
