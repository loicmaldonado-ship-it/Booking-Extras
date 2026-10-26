import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks){const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;const exports={};new Function('require','exports',code)(name=>name in mocks?mocks[name]:require(name),exports);return exports;}
const owner={id:'actor',role:'chef'}, assistant={id:'assistant',role:'assistant',sectionsAutorisees:['/bookings']};
const section=(actor,key)=>!!actor&&(actor.role==='chef'||actor.sectionsAutorisees==null||actor.sectionsAutorisees.includes(key));
test('private dossier reads reject anonymous, section-restricted, foreign-project and invisible-child access',async()=>{
 for(const scenario of ['anonymous','section','foreign','invisible','allowed']){
  let admins=0,profileReads=0;
  const mocks={'server-only':{},'@/lib/auth/sections':{hasSectionAccess:section},'@/lib/auth/session':{getCurrentProfile:async()=>scenario==='anonymous'?null:scenario==='section'?assistant:owner,checkProjetAccess:async()=>scenario==='foreign'?'denied':null},'@/lib/minors/model':{},'@/lib/minors/data':{},
   '@/lib/supabase/admin':{createAdminClient:()=>{admins++;return{from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{id:'dossier',projet_id:'project',figurant_id:'child'},error:null})})};}},
   '@/lib/supabase/server':{createServerSupabaseClient:async()=>({from:()=>{profileReads++;return{select(){return this;},eq(){return this;},maybeSingle:async()=>({data:scenario==='invisible'?null:{id:'child'},error:null})};}})},
  };
  const result=await load('src/lib/minors/dossiers.ts',mocks).staffDossier('dossier');
  assert.equal(!!result,scenario==='allowed');if(['anonymous','section'].includes(scenario))assert.equal(admins,0);if(scenario==='foreign')assert.equal(profileReads,0);
 }
});
function actionHarness({allowed=true,quota='dossier',commitError=null,uploadError=null}={}){
 const calls=[];let storedLink;
 const access={actor:owner,dossier:{id:'dossier',projet_id:'project',figurant_id:'child'}};
 const admin={rpc:async(name,payload)=>{calls.push({name,payload});return name==='consume_minor_upload'?{data:quota,error:null}:{data:'dossier/old.pdf',error:commitError};},from:table=>({insert:async value=>{storedLink=value;return{error:null};}}),storage:{from:bucket=>({upload:async(path,file,options)=>{calls.push({upload:path,bucket,type:options.contentType});return{error:uploadError};},remove:async paths=>{calls.push({remove:paths,bucket});return{error:null};}})}};
 const mocks={'@/lib/auth/sections':{hasSectionAccess:section},'@/lib/auth/session':{getCurrentProfile:async()=>owner,checkProjetAccess:async()=>null},'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/supabase/server':{},'next/navigation':{},'next/cache':{revalidatePath:()=>{}},'./dossiers':{staffDossier:async()=>allowed?access:null,bearerDossier:async()=>allowed?access:null,tokenHash:s=>createHash('sha256').update(s).digest('hex'),MINOR_BUCKET:'minor-documents'},'./model':{},'./data':{},'@/lib/media/validate-upload':{validatePdfUpload:async()=>({}),validateImageUpload:async()=>({})}};
 return {actions:load('src/lib/minors/actions.ts',mocks),calls,storedLink:()=>storedLink};
}
function uploadForm(){const fd=new FormData();fd.set('source_key','guardian_1');fd.set('file',new File(['%PDF-1.7\nfixture'],'fixture.pdf',{type:'application/pdf'}));return fd;}
test('denied dossier actions cannot create links or upload files',async()=>{
 const h=actionHarness({allowed:false});const fd=new FormData();fd.set('kind','production');assert.ok((await h.actions.createMinorLink('dossier',null,fd)).error);assert.ok((await h.actions.uploadMinorDocument('a'.repeat(64),null,uploadForm())).error);assert.deepEqual(h.calls,[]);assert.equal(h.storedLink(),undefined);
});
test('a rejected or foreign dossier quota cannot reach Storage',async()=>{
 for(const quota of [null,'foreign-dossier']){const h=actionHarness({quota});assert.ok((await h.actions.uploadMinorDocument('a'.repeat(64),null,uploadForm())).error);assert.equal(h.calls.length,1);}
});
test('revocation while a file is uploading causes rollback cleanup instead of committing a document',async()=>{
 const h=actionHarness({commitError:{message:'revoked'}});assert.ok((await h.actions.uploadMinorDocument('a'.repeat(64),null,uploadForm())).error);
 const path=h.calls.find(c=>c.upload).upload;assert.ok(path.startsWith('dossier/'));assert.ok(h.calls.some(c=>c.remove?.includes(path)));assert.equal(h.calls.find(c=>c.name==='commit_minor_upload').payload.p_path,path);
});
test('successful replacement stores a received document and removes the previous file',async()=>{
 const h=actionHarness();assert.match((await h.actions.uploadMinorDocument('a'.repeat(64),null,uploadForm())).success,/reçu/);assert.ok(h.calls.some(c=>c.remove?.includes('dossier/old.pdf')));assert.ok(!h.calls.some(c=>c.name==='review_minor_document'));
});
test('bearer links use random 256-bit tokens while only hashes are persisted',async()=>{
 const h=actionHarness();const fd=new FormData();fd.set('kind','production');const result=await h.actions.createMinorLink('dossier',null,fd);const raw=result.url.split('/').at(-1);assert.match(raw,/^[0-9a-f]{64}$/);assert.equal(h.storedLink().token_hash,createHash('sha256').update(raw).digest('hex'));assert.ok(!JSON.stringify(h.storedLink()).includes(raw));assert.equal(h.storedLink().dossier_id,'dossier');
});
test('DRIEETS dataset refuses a mismatched project before querying business data',async()=>{
 let admins=0;const mocks={'server-only':{},'@/lib/supabase/admin':{createAdminClient:()=>{admins++;throw Error('must not query');}},'@/lib/minors/dossiers':{staffDossier:async()=>({dossier:{projet_id:'another-project'}})},'./model':{}};
 assert.equal(await load('src/lib/drieets/data.ts',mocks).getMinorPreparation('project','dossier'),null);assert.equal(admins,0);
});
