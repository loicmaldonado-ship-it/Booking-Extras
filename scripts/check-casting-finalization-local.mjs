import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import sharp from 'sharp';
import {createClient} from '@supabase/supabase-js';
const backend=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);assert.equal(process.env.BOOKING_TEST_MODE,'1');assert.ok(backend.protocol==='http:'&&['localhost','127.0.0.1'].includes(backend.hostname));
const admin=createClient(backend.href,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const check=r=>{assert.ifError(r.error);return r.data;};
const simple=file=>{const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const exports={};new Function('require','exports',code)(name=>{throw Error('Import non prévu '+name);},exports);return exports;};
const mocks={'@/lib/noms':simple('src/lib/noms.ts'),'@/lib/figurants/types':simple('src/lib/figurants/types.ts'),'next/cache':{revalidatePath:()=>{}},'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/auth/session':{checkProjetAccess:async()=> 'Accès staff non fourni'},'@/lib/figurants/liens':{upsertFigurantLienByLabel:()=>{throw Error('Bande démo non utilisée dans cette fixture');}},'@/lib/notifications/create':{createNotification:async(type,titre,opts)=>check(await admin.from('notifications').insert({type,titre,figurant_id:opts.figurantId,projet_id:opts.projetId,lien:opts.lien}))},'./upload-paths':simple('src/lib/casting/upload-paths.ts')};
const code=ts.transpileModule(readFileSync(new URL('../src/lib/casting/upload-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const actions={};new Function('require','exports',code)(name=>{assert.ok(name in mocks,name);return mocks[name];},actions);
const project=randomUUID(),person=randomUUID(),role=randomUUID(),entry=randomUUID(),requestToken=randomUUID(),paths=[];
try{
 check(await admin.from('projets').insert({id:project,nom:'Finalisation casting fictive',owner_id:'00000000-0000-4000-8000-00000000c0c0'}));
 check(await admin.from('figurants').insert({id:person,prenom:'Casting',nom:'Finalisation fictive',date_naissance:'1990-01-01'}));
 check(await admin.from('casting_roles').insert({id:role,projet_id:project,nom:'Rôle fictif',nb_videos:0,photo_labels:['Portrait'],questions:['Question fictive']}));
 check(await admin.from('casting_entries').insert({id:entry,projet_id:project,figurant_id:person,role_id:role,request_token:requestToken}));
 const slot=await actions.createCastingUploadSlot(requestToken,'photo','Portrait');assert.ifError(slot.error);paths.push(slot.path);
 const jpeg=await sharp({create:{width:32,height:32,channels:3,background:'#23a'}}).jpeg().toBuffer();
 check(await admin.storage.from(slot.bucket).uploadToSignedUrl(slot.path,slot.token,jpeg,{contentType:'image/jpeg'}));
 const result=await actions.finalizeCastingUpload(requestToken,{videoPaths:[],photos:[{label:'Portrait',path:slot.path}],reponses:[]});
 assert.match(result.error,/questions/);
 assert.equal(check(await admin.from('figurant_photos').select('id').eq('casting_entry_id',entry)).length,0,'Réponses incomplètes : aucune photo métier ne doit être enregistrée');
 console.log('PASS: réponses incomplètes refusées sans mutation métier');
 const valid={videoPaths:[],photos:[{label:'Portrait',path:slot.path}],reponses:[{question:'Question fictive',reponse:'oui'}]};
 const foreign={...valid,photos:[{label:'Portrait',path:slot.path.replace(entry,randomUUID())}]};
 assert.match((await actions.finalizeCastingUpload(requestToken,foreign)).error,/Chemin photo/);
 const missing=await actions.createCastingUploadSlot(requestToken,'photo','Portrait');assert.ifError(missing.error);paths.push(missing.path);
 assert.match((await actions.finalizeCastingUpload(requestToken,{...valid,photos:[{label:'Portrait',path:missing.path}]})).error,/retrouvée/);
 assert.equal(check(await admin.from('figurant_photos').select('id').eq('casting_entry_id',entry)).length,0);
 console.log('PASS: chemin d’une autre entrée et fichier absent refusés sans mutation');
 const success=await actions.finalizeCastingUpload(requestToken,valid);assert.ifError(success.error);assert.equal(success.success,true);
 assert.ok(check(await admin.from('casting_entries').select('submitted_at').eq('id',entry).single()).submitted_at);
 assert.equal(check(await admin.from('figurant_photos').select('id').eq('casting_entry_id',entry)).length,1);
 assert.match((await actions.finalizeCastingUpload(requestToken,valid)).error,/transmis|clôturé/);
 assert.match((await actions.createCastingUploadSlot(requestToken,'photo','Portrait')).error,/transmis|clôturé/);
 assert.equal(check(await admin.from('figurant_photos').select('id').eq('casting_entry_id',entry)).length,1);
 console.log('PASS: première soumission complète, seconde et nouveau slot refusés sans duplication');
 if(process.argv.includes('--stale-slot')){
  const late=await admin.storage.from(missing.bucket).uploadToSignedUrl(missing.path,missing.token,jpeg,{contentType:'image/jpeg'});
  assert.ok(late.error,'BUG-14 : une signature obtenue avant finalisation doit refuser un dépôt après finalisation');
  console.log('PASS: ancienne signature de dépôt refusée après finalisation');
 }

}finally{
 if(paths.length)check(await admin.storage.from('figurant-photos').remove(paths));
 check(await admin.from('notifications').delete().eq('figurant_id',person));
 check(await admin.from('projets').delete().eq('id',project));
 check(await admin.from('figurants').delete().eq('id',person));
 console.log('PASS nettoyage: seules les données et images fictives de cette recette retirées');
}
