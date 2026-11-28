import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
assert.ok(url.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(url.hostname),'Tests réservés à la base locale');
assert.equal(process.env.BOOKING_TEST_MODE,'1','Mode test obligatoire');
const opts={auth:{persistSession:false,autoRefreshToken:false}};
const anon=createClient(url.href,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts);
const {error:publicError}=await anon.from('figurants').select('id').limit(1);
assert.equal(publicError?.code,'42501');
console.log('PASS REST public: profils interdits (42501)');
const server=createClient(url.href,process.env.SUPABASE_SERVICE_ROLE_KEY,opts);
for (const table of ['profiles','figurants','figurant_comptes','figurant_sessions','projets','bookings','reserve_profils','candidature_etiquettes','textos_file']) {
 const {error}=await server.from(table).select('*',{head:true,count:'exact'});
 assert.ifError(error); console.log(`PASS REST service_role: ${table}`);
}
for (const email of ['cheffe.test@test-chat-charge.fr','assistante.test@test-chat-charge.fr']) {
 const client=createClient(url.href,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,opts);
 const login=await client.auth.signInWithPassword({email,password:'booking-test'});
 assert.ifError(login.error);
 const projets=await client.from('projets').select('id');assert.ifError(projets.error);assert.equal(projets.data.length,1);
 const secrets=await client.from('figurant_comptes').select('*');assert.equal(secrets.error?.code,'42501');
 console.log(`PASS REST ${email.startsWith('cheffe')?'cheffe':'assistante'}: connexion, projet membre, secrets refusés`);
 await client.auth.signOut();
}
