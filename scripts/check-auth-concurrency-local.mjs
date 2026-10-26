import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const url=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
assert.ok(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname));
assert.equal(process.env.BOOKING_TEST_MODE,'1');
const client=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const id=randomUUID(),token=randomUUID().replaceAll('-','');
try {
 assert.ifError((await client.from('figurants').insert({id,prenom:'Concurrence',nom:'Fixture',acces_compte:true,date_naissance:'1995-01-01'})).error);
 assert.ifError((await client.from('figurant_sessions').insert({figurant_id:id,token,expires_at:new Date(Date.now()+3600000).toISOString()})).error);
 const answers=await Promise.all(['a','b'].map(c=>client.rpc('changer_mot_de_passe_candidat',{
  p_id:id,p_hash:c.repeat(32)+':'+c.repeat(128),p_creer_session:true,p_current_token:token,
 })));
 assert.equal(answers.filter(x=>!x.error).length,1,'Deux changements ont réutilisé la même session');
 const winner=answers.find(x=>!x.error);
 const sessions=await client.from('figurant_sessions').select('token').eq('figurant_id',id);
 assert.ifError(sessions.error);assert.equal(sessions.data.length,1);assert.equal(sessions.data[0].token,winner.data.token);
 console.log('PASS REST concurrence réelle : deux requêtes simultanées, une réussite, un refus, une seule nouvelle session');
} finally {
 const {error}=await client.from('figurants').delete().eq('id',id);assert.ifError(error);
 console.log('PASS nettoyage de la seule fixture créée pour ce test');
}
