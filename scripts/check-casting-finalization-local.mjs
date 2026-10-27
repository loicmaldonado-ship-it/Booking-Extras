import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import sharp from 'sharp';
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
const backend=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);assert.equal(process.env.BOOKING_TEST_MODE,'1');assert.ok(backend.protocol==='http:'&&['localhost','127.0.0.1'].includes(backend.hostname));
const admin=createClient(backend.href,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const check=r=>{assert.ifError(r.error);return r.data;};
const simple=file=>{const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const exports={};new Function('require','exports',code)(name=>{if(name==='sharp')return sharp;throw Error('Import non prévu '+name);},exports);return exports;};
const mocks={'@/lib/media/validate-upload':simple('src/lib/media/validate-upload.ts'),'@/lib/noms':simple('src/lib/noms.ts'),'@/lib/figurants/types':simple('src/lib/figurants/types.ts'),'next/cache':{revalidatePath:()=>{}},'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/auth/session':{checkProjetAccess:async()=> 'Accès staff non fourni'},'@/lib/figurants/liens':{upsertFigurantLienByLabel:()=>{throw Error('Bande démo non utilisée dans cette fixture');}},'@/lib/notifications/create':{createNotification:async(type,titre,opts)=>check(await admin.from('notifications').insert({type,titre,figurant_id:opts.figurantId,projet_id:opts.projetId,lien:opts.lien}))},'./upload-paths':simple('src/lib/casting/upload-paths.ts')};
const code=ts.transpileModule(readFileSync(new URL('../src/lib/casting/upload-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const actions={};new Function('require','exports',code)(name=>{assert.ok(name in mocks,name);return mocks[name];},actions);
const project=randomUUID(),person=randomUUID(),role=randomUUID(),entry=randomUUID(),requestToken=randomUUID(),paths=[],videoFiles=[];
try{
 check(await admin.from('projets').insert({id:project,nom:'Finalisation casting fictive',owner_id:'00000000-0000-4000-8000-00000000c0c0'}));
 check(await admin.from('figurants').insert({id:person,prenom:'Casting',nom:'Finalisation fictive',date_naissance:'1990-01-01'}));
 check(await admin.from('casting_roles').insert({id:role,projet_id:project,nom:'Rôle fictif',nb_videos:0,photo_labels:['Portrait'],questions:['Question fictive']}));
 check(await admin.from('casting_entries').insert({id:entry,projet_id:project,figurant_id:person,role_id:role,request_token:requestToken}));
 assert.ok((await actions.createCastingUploadSlot(requestToken,'pdf','Portrait')).error);
 const slot=await actions.createCastingUploadSlot(requestToken,'photo','Portrait');assert.ifError(slot.error);paths.push(slot.path);
 const jpeg=await sharp({create:{width:32,height:32,channels:3,background:'#23a'}}).jpeg().toBuffer();
 check(await admin.storage.from(slot.bucket).uploadToSignedUrl(slot.path,slot.token,jpeg,{contentType:'image/jpeg'}));
 const result=await actions.finalizeCastingUpload(requestToken,{videoPaths:[],photos:[{label:'Portrait',path:slot.path}],reponses:[]});
 assert.match(result.error,/questions/);
 assert.equal(check(await admin.from('figurant_photos').select('id').eq('casting_entry_id',entry)).length,0,'Réponses incomplètes : aucune photo métier ne doit être enregistrée');
 console.log('PASS: réponses incomplètes refusées sans mutation métier');
 const valid={videoPaths:[],photos:[{label:'Portrait',path:slot.path}],reponses:[{question:'Question fictive',reponse:'oui'}]};
 const foreignRole=randomUUID(),foreignEntry=randomUUID(),foreignToken=randomUUID();
 check(await admin.from('casting_roles').insert({id:foreignRole,projet_id:project,nom:'Rôle étranger fictif',nb_videos:2,photo_labels:['Portrait']}));
 check(await admin.from('casting_entries').insert({id:foreignEntry,projet_id:project,figurant_id:person,role_id:foreignRole,request_token:foreignToken}));
 const foreignSlot=await actions.createCastingUploadSlot(foreignToken,'photo','Portrait');assert.ifError(foreignSlot.error);paths.push(foreignSlot.path);
 check(await admin.storage.from(foreignSlot.bucket).uploadToSignedUrl(foreignSlot.path,foreignSlot.token,jpeg,{contentType:'image/jpeg'}));
 const foreign={...valid,photos:[{label:'Portrait',path:foreignSlot.path}]};
 assert.match((await actions.finalizeCastingUpload(requestToken,foreign)).error,/Chemin photo/);
 const missing=await actions.createCastingUploadSlot(requestToken,'photo','Portrait');assert.ifError(missing.error);paths.push(missing.path);
 assert.match((await actions.finalizeCastingUpload(requestToken,{...valid,photos:[{label:'Portrait',path:missing.path}]})).error,/retrouvée/);
 assert.equal(check(await admin.from('figurant_photos').select('id').eq('casting_entry_id',entry)).length,0);
 console.log('PASS: chemin d’une autre entrée et fichier absent refusés sans mutation');
 const bad=await actions.createCastingUploadSlot(requestToken,'photo','Portrait');assert.ifError(bad.error);paths.push(bad.path);
 check(await admin.storage.from(bad.bucket).uploadToSignedUrl(bad.path,bad.token,Buffer.from([255,216,255,0,0]),{contentType:'image/jpeg'}));
 assert.match((await actions.finalizeCastingUpload(requestToken,{...valid,photos:[{label:'Portrait',path:bad.path}]})).error,/Image invalide/);
 const badMime=await actions.createCastingUploadSlot(requestToken,'photo','Portrait');assert.ifError(badMime.error);paths.push(badMime.path);
 check(await admin.storage.from(badMime.bucket).uploadToSignedUrl(badMime.path,badMime.token,jpeg,{contentType:'application/octet-stream'}));
 assert.match((await actions.finalizeCastingUpload(requestToken,{...valid,photos:[{label:'Portrait',path:badMime.path}]})).error,/Image invalide/);
 assert.equal(check(await admin.from('figurant_photos').select('id').eq('casting_entry_id',entry)).length,0);
 console.log('PASS: fausse image et MIME trompeur refusés après dépôt direct, sans référence métier');

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
  const signed=check(await admin.storage.from(slot.bucket).createSignedUrl(slot.path,60)).signedUrl;
  assert.equal((await fetch(signed)).status,200,'La lecture des médias transmis doit rester possible');
  let authCalls=0;
  const staffCode=ts.transpileModule(readFileSync(new URL('../src/lib/casting/actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const staffActions={};const staffMocks={...mocks,'@/lib/auth/session':{checkProjetAccess:async id=>{authCalls++;assert.equal(id,project);return null;}}};
  new Function('require','exports',staffCode)(name=>staffMocks[name]??{},staffActions);
  const fd=new FormData();fd.set('photo',new File([jpeg],'staff.jpg',{type:'image/jpeg'}));
  const staffPhoto=await staffActions.addCastingPhoto(entry,entry+'-Portrait',fd);assert.ifError(staffPhoto.error);assert.equal(authCalls,1);
  const added=check(await admin.from('figurant_photos').select('storage_path').eq('casting_entry_id',entry).eq('label',entry+'-Portrait').single());paths.push(added.storage_path);assert.ok(added.storage_path.startsWith(person+'/staff-casting-'));

  console.log('PASS: média transmis toujours lisible et chemin de dépôt équipe toujours utilisable');

 }

 if(process.argv.includes('--race')){
 for(let attempt=0;attempt<5;attempt++){
  check(await admin.from('casting_entries').update({submitted_at:null,statut:'proposé'}).eq('id',entry));
  check(await admin.from('figurant_photos').delete().eq('casting_entry_id',entry));
  const results=await Promise.all([actions.finalizeCastingUpload(requestToken,valid),actions.finalizeCastingUpload(requestToken,valid)]);
  assert.equal(results.filter(r=>r.success===true).length,1,'Une seule soumission doit gagner');
  assert.equal(check(await admin.from('figurant_photos').select('id').eq('casting_entry_id',entry)).length,1,'La finalisation concurrente ne doit pas dupliquer les références photo');
 }
  console.log('PASS: cinq courses de finalisations concurrentes, un seul succès et une seule photo à chaque fois');
 }
 const clipResult=spawnSync(ffmpeg.path,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=black:s=16x16:d=0.2','-an','-c:v','libx264','-movflags','frag_keyframe+empty_moov','-f','mp4','pipe:1'],{maxBuffer:8*1024*1024});
 assert.equal(clipResult.status,0,String(clipResult.stderr));const clip=clipResult.stdout;assert.ok(clip.length>100);
 const foreignVideo=await actions.createCastingUploadSlot(foreignToken,'video','0');assert.ifError(foreignVideo.error);videoFiles.push(foreignVideo.path);
 check(await admin.storage.from(foreignVideo.bucket).uploadToSignedUrl(foreignVideo.path,foreignVideo.token,clip,{contentType:'video/mp4'}));
 const videoRole=randomUUID(),videoEntry=randomUUID(),videoToken=randomUUID();
 check(await admin.from('casting_roles').insert({id:videoRole,projet_id:project,nom:'Vidéos fictives',nb_videos:2,photo_labels:[]}));
 check(await admin.from('casting_entries').insert({id:videoEntry,projet_id:project,figurant_id:person,role_id:videoRole,request_token:videoToken}));
 assert.ok((await actions.createCastingUploadSlot(videoToken,'video','2')).error);
 const videos=[];
 for(let index=0;index<2;index++){const v=await actions.createCastingUploadSlot(videoToken,'video',String(index));assert.ifError(v.error);videoFiles.push(v.path);videos.push(v);check(await admin.storage.from(v.bucket).uploadToSignedUrl(v.path,v.token,clip,{contentType:'video/mp4'}));}
 const videoPayload={videoPaths:videos.map(v=>v.path),photos:[]};
 const canonical=await actions.createCastingUploadSlot(videoToken,'video','0.0');assert.ifError(canonical.error);videoFiles.push(canonical.path);assert.ok(canonical.path.includes(videoEntry+'-video-0-'));
 check(await admin.storage.from(canonical.bucket).uploadToSignedUrl(canonical.path,canonical.token,clip,{contentType:'video/mp4'}));
 assert.match((await actions.finalizeCastingUpload(videoToken,{...videoPayload,videoPaths:[videos[0].path,canonical.path]})).error,/Créneau vidéo dupliqué/);
 const staleDecimal=await actions.createCastingUploadSlot(videoToken,'video',' 0 ');assert.ifError(staleDecimal.error);videoFiles.push(staleDecimal.path);assert.ok(staleDecimal.path.includes(videoEntry+'-video-0-'));

 assert.match((await actions.finalizeCastingUpload(videoToken,{...videoPayload,videoPaths:[foreignVideo.path]})).error,/Chemin vidéo/);
 assert.match((await actions.finalizeCastingUpload(videoToken,{...videoPayload,videoPaths:[videos[0].path,videos[0].path]})).error,/Chemin vidéo/);
 assert.match((await actions.finalizeCastingUpload(videoToken,{...videoPayload,videoPaths:[...videoPayload.videoPaths,foreignVideo.path]})).error,/Nombre/);
 const absentVideo=await actions.createCastingUploadSlot(videoToken,'video','0');assert.ifError(absentVideo.error);videoFiles.push(absentVideo.path);
 assert.match((await actions.finalizeCastingUpload(videoToken,{...videoPayload,videoPaths:[absentVideo.path]})).error,/retrouvée/);
 const submitted=await actions.finalizeCastingUpload(videoToken,videoPayload);assert.ifError(submitted.error);assert.equal(submitted.success,true);
 assert.deepEqual(check(await admin.from('casting_entries').select('video_storage_paths').eq('id',videoEntry).single()).video_storage_paths,videoPayload.videoPaths);
 assert.ok((await admin.storage.from(staleDecimal.bucket).uploadToSignedUrl(staleDecimal.path,staleDecimal.token,clip,{contentType:'video/mp4'})).error);
 assert.ok((await admin.storage.from(absentVideo.bucket).uploadToSignedUrl(absentVideo.path,absentVideo.token,clip,{contentType:'video/mp4'})).error);
 console.log('PASS: deux MP4 réels déposés, vidéos étrangères/dupliquées/trop nombreuses/absentes et ancien dépôt tardif refusés');
 const staffVideoCode=ts.transpileModule(readFileSync(new URL('../src/lib/casting/actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const staffVideos={};const staffVideoMocks={...mocks,'@/lib/auth/session':{checkProjetAccess:async id=>{assert.equal(id,project);return null;}}};
 new Function('require','exports',staffVideoCode)(name=>staffVideoMocks[name]??{},staffVideos);
 assert.match((await staffVideos.addCastingVideo(videoEntry,foreignVideo.path)).error,/non autorisé/);
 await assert.rejects(staffVideos.removeCastingVideo(videoEntry,foreignVideo.path),/n’appartient pas/);
 check(await admin.storage.from('casting-videos').info(foreignVideo.path));
 const staffVideo=await staffVideos.createStaffCastingVideoSlot(videoEntry);assert.ifError(staffVideo.error);videoFiles.push(staffVideo.path);
 check(await admin.storage.from(staffVideo.bucket).uploadToSignedUrl(staffVideo.path,staffVideo.token,clip,{contentType:'video/mp4'}));
 const addedVideo=await staffVideos.addCastingVideo(videoEntry,staffVideo.path,'Vidéo équipe fictive');assert.ifError(addedVideo.error);
 const repeatedVideo=await staffVideos.addCastingVideo(videoEntry,staffVideo.path,'Vidéo équipe fictive');assert.ifError(repeatedVideo.error);
 const finalVideo=check(await admin.from('casting_entries').select('video_storage_paths,video_labels').eq('id',videoEntry).single());assert.equal(finalVideo.video_storage_paths.length,3);assert.deepEqual(finalVideo.video_labels,['Vidéo 1','Vidéo 2','Vidéo équipe fictive']);
 console.log('PASS: ajout équipe après transmission préservé et idempotent ; rattachement/suppression de vidéo étrangère refusés, fichier étranger intact');
 check(await admin.from('casting_entries').update({video_storage_paths:[staffVideo.path],video_labels:['Partagée fictive']}).eq('id',foreignEntry));
 await staffVideos.removeCastingVideo(videoEntry,staffVideo.path);
 check(await admin.storage.from('casting-videos').info(staffVideo.path));
 assert.deepEqual(check(await admin.from('casting_entries').select('video_storage_paths').eq('id',foreignEntry).single()).video_storage_paths,[staffVideo.path]);
 assert.equal(check(await admin.from('casting_entries').select('video_storage_paths').eq('id',videoEntry).single()).video_storage_paths.length,2);
 console.log('PASS: retrait d’une référence historique partagée préserve le fichier et l’autre entrée');


}finally{
 if(paths.length)check(await admin.storage.from('figurant-photos').remove(paths));
 if(videoFiles.length)check(await admin.storage.from('casting-videos').remove(videoFiles));
 check(await admin.from('notifications').delete().eq('figurant_id',person));
 check(await admin.from('projets').delete().eq('id',project));
 check(await admin.from('figurants').delete().eq('id',person));
 console.log('PASS nettoyage: seules les données et images fictives de cette recette retirées');
}
