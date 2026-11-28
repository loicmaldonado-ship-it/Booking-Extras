import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);assert.equal(process.env.BOOKING_TEST_MODE,'1');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,options),owner=createClient(url.href,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options),assistant=createClient(url.href,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);
const check=r=>{assert.ifError(r.error);return r.data;};const all=[];
try{
 check(await owner.auth.signInWithPassword({email:'cheffe.test@test-chat-charge.fr',password:'booking-test'}));
 check(await assistant.auth.signInWithPassword({email:'assistante.test@test-chat-charge.fr',password:'booking-test'}));
 for(let trial=0;trial<5;trial++){
  const a=randomUUID(),b=randomUUID();all.push(a,b);
  check(await admin.from('figurants').insert([{id:a,prenom:'Fusion',nom:'A fictive',date_naissance:'1990-01-01'},{id:b,prenom:'Fusion',nom:'B fictive',date_naissance:'1990-01-01'}]));
  check(await admin.from('figurant_liens').insert([{figurant_id:a,label:'A',url:'https://example.test/a'},{figurant_id:b,label:'B',url:'https://example.test/b'}]));
  const denied=await assistant.rpc('merge_figurants_atomique',{p_keep_id:a,p_merge_id:b});assert.equal(denied.error?.code,'42501');
  assert.equal(check(await admin.from('figurants').select('id').in('id',[a,b])).length,2);
  const results=await Promise.all([owner.rpc('merge_figurants_atomique',{p_keep_id:a,p_merge_id:b}),owner.rpc('merge_figurants_atomique',{p_keep_id:b,p_merge_id:a})]);
  assert.equal(results.filter(r=>!r.error).length,1);assert.equal(results.find(r=>r.error)?.error.code,'P0002');
  const remaining=check(await admin.from('figurants').select('id').in('id',[a,b]));assert.equal(remaining.length,1);
  const links=check(await admin.from('figurant_liens').select('figurant_id,label').in('figurant_id',[a,b]));assert.equal(links.length,2);assert.ok(links.every(l=>l.figurant_id===remaining[0].id));
 }
 console.log('PASS: assistante refusée dans 5 cas ; 5 courses de fusion inversée, un succès et un refus propre, aucun lien perdu');
}finally{
 if(all.length)check(await admin.from('figurants').delete().in('id',all));
 await owner.auth.signOut({scope:'local'});await assistant.auth.signOut({scope:'local'});
 console.log('PASS nettoyage: seuls les profils et sessions fictifs créés par ce script supprimés');
}
