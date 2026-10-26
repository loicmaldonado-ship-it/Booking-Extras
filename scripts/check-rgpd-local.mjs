import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
assert.equal(process.env.BOOKING_TEST_MODE,'1');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));
const admin=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const anon=createClient(url.href,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const subject=randomUUID(),other=randomUUID(),actor='00000000-0000-4000-8000-00000000c0c0',bucket='figurant-photos',path=`${subject}/test.png`;
const check=r=>{assert.ifError(r.error);return r.data;};
let prepared=false;
try{
 check(await admin.from('figurants').insert([{id:subject,prenom:'RGPD',nom:'Fictif',email:'rgpd-fixture@example.test',date_naissance:'1990-01-01',code_postal:'75000',agent_email:'agent@example.test',acces_compte:true},{id:other,prenom:'Autre',nom:'Fictif',acces_compte:false}]));
 check(await admin.storage.from(bucket).upload(path,Buffer.from('fichier fictif'),{contentType:'image/png'}));
 const replacement=check(await admin.storage.from(bucket).createSignedUploadUrl(path,{upsert:true}));
 check(await admin.storage.from(bucket).uploadToSignedUrl(replacement.path,replacement.token,Buffer.from('remplacement actif'),{contentType:'image/png'}));
 const upload=check(await admin.storage.from(bucket).createSignedUploadUrl(`${subject}/retard.png`));
 assert.ok((await anon.rpc('preparer_effacement_figurant',{p_id:subject,p_actor:actor})).error,'RPC exposée à anon');
 assert.ok((await admin.rpc('preparer_effacement_figurant',{p_id:subject,p_actor:'00000000-0000-4000-8000-00000000a551'})).error,'Assistant autorisé');
 const plan=check(await admin.rpc('preparer_effacement_figurant',{p_id:subject,p_actor:actor}));prepared=true;
 assert.deepEqual(plan.files,[{bucket,path}]);
 const row=check(await admin.from('figurants').select('*').eq('id',subject).single());
 assert.equal(row.email,null);assert.equal(row.date_naissance,null);assert.equal(row.agent_email,null);assert.equal(row.code_postal,null);assert.equal(row.acces_compte,false);assert.ok(row.anonymisation_en_cours_at);assert.equal(row.anonymise,false);
 assert.ok((await admin.from('figurants').update({email:'retard@example.test'}).eq('id',subject)).error);
 assert.ok((await admin.storage.from(bucket).uploadToSignedUrl(upload.path,upload.token,Buffer.from('retard'))).error,'Ancien droit upload accepté');
 assert.ok((await admin.storage.from(bucket).uploadToSignedUrl(replacement.path,replacement.token,Buffer.from('remplacement'),{contentType:'image/png'})).error,'Remplacement signé antérieur accepté');
 assert.ok((await admin.rpc('terminer_effacement_figurant',{p_id:subject,p_actor:actor})).error,'Succès avec fichier restant');
 assert.deepEqual(check(await admin.rpc('preparer_effacement_figurant',{p_id:subject,p_actor:actor})).files,plan.files);
 console.log('PASS API: droits, remplacement actif autorisé, révocation, dépôt et remplacement signés antérieurs refusés, fichier restant bloque la fin, reprise conserve le plan');
 check(await admin.storage.from(bucket).remove([path]));
 check(await admin.rpc('terminer_effacement_figurant',{p_id:subject,p_actor:actor}));
 const final=check(await admin.from('figurants').select('anonymise,anonymisation_en_cours_at').eq('id',subject).single());assert.equal(final.anonymise,true);assert.equal(final.anonymisation_en_cours_at,null);
 assert.deepEqual(check(await admin.from('rgpd_fichiers_a_effacer').select('*').eq('figurant_id',subject)),[]);
 assert.equal(check(await admin.from('figurants').select('prenom').eq('id',other).single()).prenom,'Autre');
 console.log('PASS API: suppression Storage réelle, finalisation confirmée, autre profil intact');
}finally{
 check(await admin.storage.from(bucket).remove([path,`${subject}/retard.png`]));
 if(prepared) {const state=check(await admin.from('figurants').select('anonymisation_en_cours_at').eq('id',subject).maybeSingle());if(state?.anonymisation_en_cours_at)check(await admin.rpc('terminer_effacement_figurant',{p_id:subject,p_actor:actor}));}
 check(await admin.from('figurants').delete().in('id',[subject,other]));
 console.log('PASS nettoyage: seuls les profils et fichiers fictifs de ce test supprimés');
}
