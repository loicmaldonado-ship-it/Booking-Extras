import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);assert.equal(process.env.BOOKING_TEST_MODE,'1');assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname));
const options={auth:{persistSession:false,autoRefreshToken:false}},admin=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,options),rows=[],clients=[],users=[];
const check=r=>{assert.ifError(r.error);return r.data;};
const day=new Date(Date.now()+20*86400000).toISOString().slice(0,10);
try{
 for(let i=0;i<2;i++){
  const email=`casting-${randomUUID()}@example.test`,password=randomBytes(24).toString('hex');
  const user=check(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(user.id);
  check(await admin.from('profiles').update({role:'chef',is_owner:false}).eq('id',user.id));
  const row={user:user.id,project:randomUUID(),day:randomUUID(),slot:randomUUID(),person:randomUUID(),entry:randomUUID()};rows.push(row);
  check(await admin.from('projets').insert({id:row.project,owner_id:user.id,nom:'Casting RLS fictif '+i}));
  check(await admin.from('figurants').insert({id:row.person,prenom:'Casting',nom:'Fictif '+i,date_naissance:'1990-01-01',temporaire_projet_id:row.project}));
  check(await admin.from('casting_presentiel_journees').insert({id:row.day,projet_id:row.project,date:day}));
  check(await admin.from('casting_presentiel_creneaux').insert({id:row.slot,journee_id:row.day,heure_debut:'10:00',heure_fin:'11:00'}));
  check(await admin.from('casting_presentiel_entries').insert({id:row.entry,projet_id:row.project,journee_id:row.day,creneau_id:row.slot,figurant_id:row.person}));
  const client=createClient(url.href,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,options);clients.push(client);check(await client.auth.signInWithPassword({email,password}));
 }
 for(let i=0;i<2;i++){
  const client=clients[i],own=rows[i],foreign=rows[1-i];
  for(const [table,ownId,foreignId,patch] of [['casting_presentiel_creneaux',own.slot,foreign.slot,{capacite:99}],['casting_presentiel_entries',own.entry,foreign.entry,{notes:'INTRUSION'}]]){
   assert.equal(check(await client.from(table).select('id').eq('id',ownId)).length,1);
   assert.deepEqual(check(await client.from(table).select('id').eq('id',foreignId)),[]);
   assert.deepEqual(check(await client.from(table).update(patch).eq('id',foreignId).select('id')),[]);
   assert.deepEqual(check(await client.from(table).delete().eq('id',foreignId).select('id')),[]);
   assert.equal(check(await admin.from(table).select('id').eq('id',foreignId)).length,1);
  }
  assert.equal((await client.from('casting_presentiel_creneaux').insert({journee_id:foreign.day,heure_debut:'12:00',heure_fin:'13:00'})).error?.code,'42501');
  assert.equal((await client.from('casting_presentiel_entries').insert({projet_id:foreign.project,journee_id:foreign.day,creneau_id:foreign.slot,figurant_id:own.person})).error?.code,'42501');
  assert.equal(check(await client.from('casting_presentiel_entries').update({notes:'Autorisé'}).eq('id',own.entry).select('id')).length,1);
  assert.equal(check(await client.from('casting_presentiel_entries').delete().eq('id',own.entry).select('id')).length,1);
  check(await client.from('casting_presentiel_entries').insert({id:own.entry,projet_id:own.project,journee_id:own.day,creneau_id:own.slot,figurant_id:own.person}));
  const extra=randomUUID();check(await client.from('casting_presentiel_creneaux').insert({id:extra,journee_id:own.day,heure_debut:'12:00',heure_fin:'13:00'}));
  assert.equal(check(await client.from('casting_presentiel_creneaux').update({capacite:2}).eq('id',extra).select('id')).length,1);
  assert.equal(check(await client.from('casting_presentiel_creneaux').delete().eq('id',extra).select('id')).length,1);
 }
 console.log('PASS API: deux cheffes non propriétaires ; SELECT/INSERT/UPDATE/DELETE propres autorisés, croisés refusés sur créneaux et entrées');
 console.log('PASS API: données étrangères conservées après toutes tentatives');
}finally{
 for(const client of clients)await client.auth.signOut({scope:'local'});
 if(rows.length){check(await admin.from('projets').delete().in('id',rows.map(r=>r.project)));check(await admin.from('figurants').delete().in('id',rows.map(r=>r.person)));}
 for(const id of users)check(await admin.auth.admin.deleteUser(id));
 console.log('PASS nettoyage: seuls les comptes, projets et profils fictifs créés par ce test supprimés');
}
