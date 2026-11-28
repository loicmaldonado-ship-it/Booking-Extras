import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {createClient} from '@supabase/supabase-js';
const backend=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL),site=new URL(process.env.NEXT_PUBLIC_SITE_URL??'http://localhost:3000');
const loopback=url=>url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname);
assert.equal(process.env.BOOKING_TEST_MODE,'1');assert.ok(loopback(backend)&&loopback(site),'Base et site loopback uniquement');
const admin=createClient(backend.href,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const figurantId=randomUUID();
const path=`${figurantId}/${randomUUID()}.png`,privateBucket='figurant-photos',publicBucket='profile-avatars';
const image=await sharp({create:{width:32,height:32,channels:3,background:'#23a'}}).png().toBuffer();
const check=result=>{assert.ifError(result.error);return result.data;};
async function optimized(url){const target=new URL('/_next/image',site);target.searchParams.set('url',url);target.searchParams.set('w','64');target.searchParams.set('q','75');return fetch(target);}
try{
 check(await admin.from("figurants").insert({id:figurantId,prenom:"Image",nom:"Test fictif"}));
 check(await admin.storage.from(privateBucket).upload(path,image,{contentType:'image/png',cacheControl:'0'}));
 check(await admin.storage.from(publicBucket).upload(path,image,{contentType:'image/png',cacheControl:'0'}));
 const signed=check(await admin.storage.from(privateBucket).createSignedUrl(path,60)).signedUrl;
 const direct=await fetch(signed);assert.equal(direct.status,200);assert.deepEqual(Buffer.from(await direct.arrayBuffer()),image);
 const denied=await optimized(signed);assert.equal(denied.status,400,'Le proxy public doit refuser une URL privée signée');assert.match(await denied.text(),/not allowed/);
 console.log('PASS HTTP: photo privée accessible par son lien signé, refusée par le proxy public Next');
 const publicUrl=admin.storage.from(publicBucket).getPublicUrl(path).data.publicUrl;
 const allowed=await optimized(publicUrl);assert.equal(allowed.status,200,'L’optimisation des images publiques doit rester fonctionnelle');
 const metadata=await sharp(Buffer.from(await allowed.arrayBuffer())).metadata();assert.ok(metadata.width>0&&metadata.width<=64);
 console.log('PASS HTTP: image publique toujours optimisée et décodable');
 check(await admin.storage.from(privateBucket).remove([path]));assert.ok(!(await fetch(signed)).ok);
 console.log('PASS HTTP: après suppression, le lien signé ne rend plus la photo privée');
}finally{
 check(await admin.storage.from(privateBucket).remove([path]));check(await admin.storage.from(publicBucket).remove([path]));
 check(await admin.from("figurants").delete().eq("id",figurantId));
 console.log('PASS nettoyage: seules les deux images fictives du test ont été supprimées');
}
