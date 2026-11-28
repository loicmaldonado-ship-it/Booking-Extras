import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
assert.equal(process.env.BOOKING_TEST_MODE,'1','Mode test obligatoire');
assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Base loopback uniquement');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,options);
const anon=createClient(url.href,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);
const staff=createClient(url.href,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);
const child=randomUUID(),project=randomUUID(),dossier=randomUUID(),owner='00000000-0000-4000-8000-00000000c0c0';
const paths=[];const bucket='minor-documents';let signedIn=false;
const pdf=readFileSync(new URL('../tests/fixtures/minor-authorization-demo.pdf',import.meta.url));
const hash=token=>createHash('sha256').update(token).digest('hex');
const check=result=>{assert.ifError(result.error);return result.data;};
async function upload(position,token){
 const key=`guardian_${position}`;
 assert.equal(check(await admin.rpc('consume_minor_upload',{p_hash:hash(token),p_key:key})),dossier);
 const path=`${dossier}/${randomUUID()}.pdf`;paths.push(path);
 check(await admin.storage.from(bucket).upload(path,pdf,{contentType:'application/pdf',upsert:false}));
 const previous=check(await admin.rpc('commit_minor_upload',{p_hash:hash(token),p_key:key,p_path:path,p_filename:'TEST-FICTIF.pdf',p_mime:'application/pdf'}));
 return {path,previous,document:check(await admin.from('minor_documents').select('*').eq('dossier_id',dossier).eq('source_key',key).single())};
}
async function review(document,until=null){
 const position=document.source_key==='guardian_1'?1:2;
 const fingerprint=check(await admin.rpc('minor_guardian_fingerprint',{p_id:child,p_position:position}));
 check(await admin.rpc('review_minor_document',{p_document:document.id,p_state:'validated',p_until:until,p_actor:owner,p_note:'Note interne fictive',p_expected_path:document.storage_path,p_expected_guardian:fingerprint}));
}
async function denyBooking(date='2026-11-05'){
 const result=await admin.from('bookings').insert({figurant_id:child,projet_id:project,date});assert.equal(result.error?.code,'23514');
}
try{
 check(await admin.from('projets').insert({id:project,nom:'Fixture privée mineurs',owner_id:owner}));
 check(await admin.from('figurants').insert({id:child,prenom:'Fixture',nom:'Mineur REST',email:`${child}@example.test`,date_naissance:'2012-06-15'}));
 check(await admin.rpc('save_minor_guardians',{p_id:child,p_data:{first:{prenom:'Parent',nom:'Un',adresse:'1 rue de Test',telephone:'0600000001',email:`one-${child}@example.test`},second:{prenom:'Parent',nom:'Deux',adresse:'2 rue de Test',telephone:'0600000002',email:`two-${child}@example.test`}}}));
 check(await admin.from('minor_dossiers').insert({id:dossier,projet_id:project,figurant_id:child,tournage_debut:'2026-11-05',tournage_fin:'2026-11-10',commission_date:'2026-10-30'}));
 const tokens=[randomBytes(32).toString('hex'),randomBytes(32).toString('hex')];
 check(await admin.from('minor_links').insert(tokens.map((token,i)=>({dossier_id:dossier,token_hash:hash(token),kind:`guardian_${i+1}`}))));
 await denyBooking();console.log('PASS REST: dossier sans pièces refuse booking');
 const first=await upload(1,tokens[0]);assert.equal(first.document.state,'received');assert.equal(first.document.reviewed_by,null);
 await review(first.document);
 await denyBooking();console.log('PASS REST: premier dépôt reçu, validation explicite, second parent encore requis');
 const second=await upload(2,tokens[1]);await review(second.document);
 assert.equal(check(await admin.rpc('minor_dossier_complete',{p_project:project,p_child:child,p_date:'2026-11-05'})),true);
 const booking=check(await admin.from('bookings').insert({figurant_id:child,projet_id:project,date:'2026-11-05'}).select('id').single());
 console.log('PASS REST: deux vraies pièces stockées et validées permettent le booking');
 for(const table of ['minor_dossiers','minor_documents','minor_guardians','minor_requirements','minor_links'])assert.equal((await anon.from(table).select('*').limit(1)).error?.code,'42501');
 assert.ok((await anon.storage.from(bucket).download(first.path)).error);
 const publicUrl=anon.storage.from(bucket).getPublicUrl(first.path).data.publicUrl;assert.ok(!(await fetch(publicUrl)).ok);
 check(await staff.auth.signInWithPassword({email:'assistante.test@test-chat-charge.fr',password:'booking-test'}));signedIn=true;
 assert.equal((await staff.from('minor_documents').select('*').limit(1)).error?.code,'42501');
 assert.ok((await staff.storage.from(bucket).download(first.path)).error);
 assert.ok((await staff.rpc('review_minor_document',{p_document:first.document.id,p_state:'validated',p_until:null,p_actor:owner})).error);
 assert.deepEqual(check(await staff.from('projets').select('id').eq('id',project)),[]);
 console.log('PASS REST: public et rôle staff générique sans accès direct aux pièces/liens, projet étranger invisible');
 const signed=check(await admin.storage.from(bucket).createSignedUrl(first.path,60,{download:true}));
 const download=await fetch(signed.signedUrl);assert.equal(download.status,200);assert.deepEqual(Buffer.from(await download.arrayBuffer()),pdf);
 console.log('PASS REST: URL signée rend exactement le PDF fictif stocké');
 const replacement=await upload(1,tokens[0]);assert.equal(replacement.previous,first.path);assert.equal(replacement.document.state,'received');assert.equal(replacement.document.guardian_fingerprint,null);
 check(await admin.storage.from(bucket).remove([first.path]));assert.ok((await admin.storage.from(bucket).download(first.path)).error);
 assert.equal((await admin.from('bookings').update({date:'2026-11-06'}).eq('id',booking.id)).error?.code,'23514');
 assert.ok((await admin.rpc('review_minor_document',{p_document:first.document.id,p_state:'validated',p_until:null,p_actor:owner,p_expected_path:first.document.storage_path,p_expected_guardian:check(await admin.rpc('minor_guardian_fingerprint',{p_id:child,p_position:1}))})).error);
 await review(replacement.document);
 await review(second.document,'2026-11-04');
 assert.equal((await admin.from('bookings').update({date:'2026-11-06'}).eq('id',booking.id)).error?.code,'23514');
 console.log('PASS REST: remplacement annule validation, ancien fichier supprimé, expiration refuse déplacement de booking');
 check(await admin.from('minor_links').update({revoked_at:new Date().toISOString()}).eq('dossier_id',dossier));
 assert.equal(check(await admin.rpc('consume_minor_upload',{p_hash:hash(tokens[0]),p_key:'guardian_1'})),null);
 assert.ok((await admin.rpc('commit_minor_upload',{p_hash:hash(tokens[0]),p_key:'guardian_1',p_path:replacement.path,p_filename:'TEST.pdf',p_mime:'application/pdf'})).error);
 console.log('PASS REST: lien révoqué ne peut plus consommer ni terminer un dépôt');
}finally{
 if(signedIn)await staff.auth.signOut({scope:'local'});
 if(paths.length)check(await admin.storage.from(bucket).remove(paths));
 check(await admin.from('figurants').delete().eq('id',child));
 check(await admin.from('projets').delete().eq('id',project));
 console.log('PASS nettoyage: seules les fixtures privées de ce script ont été supprimées');
}
