import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);assert.equal(process.env.BOOKING_TEST_MODE,'1');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,options),owner=createClient(url.href,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options),assistant=createClient(url.href,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);
const check=r=>{assert.ifError(r.error);return r.data;};const empty=randomUUID(),withFile=randomUUID(),path=`${withFile}/orphelin-fictif.png`,bucket='figurant-photos';
try{
 check(await admin.from('figurants').insert([{id:empty,prenom:'Vide',nom:'Fixture suppression'},{id:withFile,prenom:'Fichier',nom:'Fixture suppression'}]));
 check(await admin.storage.from(bucket).upload(path,Buffer.from('fichier fictif'),{contentType:'image/png'}));
 const signed=check(await admin.storage.from(bucket).createSignedUrl(path,60)).signedUrl;
 check(await owner.auth.signInWithPassword({email:'cheffe.test@test-chat-charge.fr',password:'booking-test'}));
 check(await assistant.auth.signInWithPassword({email:'assistante.test@test-chat-charge.fr',password:'booking-test'}));
 assert.equal((await assistant.rpc('delete_unused_figurant',{p_id:empty})).error?.code,'42501');
 check(await owner.rpc('delete_unused_figurant',{p_id:empty}));assert.equal(check(await admin.from('figurants').select('id').eq('id',empty).maybeSingle()),null);
 assert.equal((await owner.rpc('delete_unused_figurant',{p_id:withFile})).error?.code,'23503');
 assert.ok(check(await admin.from('figurants').select('id').eq('id',withFile).single()));assert.equal((await fetch(signed)).status,200);
 console.log('PASS API: assistante refusée, profil vide supprimé, profil avec fichier physique sans ligne photo préservé avec son média');
 check(await admin.storage.from(bucket).remove([path]));
 check(await owner.rpc('delete_unused_figurant',{p_id:withFile}));assert.equal(check(await admin.from('figurants').select('id').eq('id',withFile).maybeSingle()),null);
 console.log('PASS API: après retrait physique du fichier, suppression du profil vide autorisée');
}finally{
 check(await admin.storage.from(bucket).remove([path]));check(await admin.from('figurants').delete().in('id',[empty,withFile]));
 await owner.auth.signOut({scope:'local'});await assistant.auth.signOut({scope:'local'});
 console.log('PASS nettoyage: seuls les profils, média et sessions fictifs de ce script supprimés');
}
