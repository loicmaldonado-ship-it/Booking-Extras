import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);assert.equal(process.env.BOOKING_TEST_MODE,'1');assert.ok(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname));
const admin=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const subject=randomUUID();const check=r=>{assert.ifError(r.error);return r.data;};
try{
 check(await admin.from('figurants').insert({id:subject,prenom:'Concurrence',nom:'Révocation fictive',acces_compte:true}));
 for(let i=0;i<20;i++){
  check(await admin.from('figurants').update({acces_compte:true}).eq('id',subject));
  const expires_at=new Date(Date.now()+3600000).toISOString();
  const operations=[()=>admin.from('figurant_sessions').insert({figurant_id:subject,token:randomUUID(),expires_at}),()=>admin.from('figurant_auth_tokens').insert({figurant_id:subject,token:randomUUID(),expires_at,objet:'connexion'}),()=>admin.from('figurants').update({acces_compte:false}).eq('id',subject)];
  if(i%2)operations.reverse();
  const results=await Promise.all(operations.map(op=>op()));
  for(const r of results)if(r.error)assert.equal(r.error.code,'42501',r.error.message);
  assert.equal(check(await admin.from('figurants').select('acces_compte').eq('id',subject).single()).acces_compte,false);
  for(const table of ['figurant_sessions','figurant_auth_tokens'])assert.deepEqual(check(await admin.from(table).select('id').eq('figurant_id',subject)),[],`${table} après course ${i}`);
 }
 console.log('PASS: 20 courses réelles session + lien de connexion + révocation, ordre alterné ; aucun jeton survivant');
 check(await admin.from('figurants').update({acces_compte:true}).eq('id',subject));
 check(await admin.from('figurant_sessions').insert({figurant_id:subject,token:randomUUID(),expires_at:new Date(Date.now()+3600000).toISOString()}));
 console.log('PASS: réactivation puis nouvelle session autorisées');
}finally{check(await admin.from('figurants').delete().eq('id',subject));console.log('PASS nettoyage: seul le profil fictif du test supprimé');}
