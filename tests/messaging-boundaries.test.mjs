import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function load(path,mocks){
 const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports',code)(name=>name in mocks?mocks[name]:require(name),exports);return exports;
}
function harness({actor={id:'staff'},denied=null,booking={projet_id:'project',figurant_id:'candidate'},person={id:'candidate',email:'fixture@example.test',agent_email:'agent@example.test'},insertError=null,mailError=null}={}){
 const trace=[],writes=[];
 const query=(data)=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data,error:null})});
 const mocks={
  'server-only':{},
  '@/lib/auth/session':{getCurrentProfile:async()=>actor,checkProjetAccess:async()=>denied},
  '@/lib/supabase/server':{createServerSupabaseClient:async()=>({from:()=>query(person)})},
  '@/lib/supabase/admin':{createAdminClient:()=>{trace.push('admin');return{from(table){if(table==='bookings')return query(booking);if(table==='figurant_messages')return {insert:async row=>{trace.push('persist');writes.push(row);return{error:insertError};}};throw Error(table);}};}},
  '@/lib/projets/email':{getProjetEmailCredentials:async()=>({credentials:null}),getOwnerEmailCredentials:async()=>({credentials:null})},
  '@/lib/push/send':{sendPushToFigurant:async()=>{trace.push('push');}},
  '@/lib/email/send':{sendEmail:async()=>{trace.push('mail');return{error:mailError};}},
 };
 return {trace,writes,send:load('src/lib/candidats/messaging.ts',mocks).recordFigurantMessage};
}
const params={figurantId:'candidate',bookingId:'booking',projetId:'project',corps:'Message de fixture',categorie:'convocation',email:'fixture@example.test'};
test('anonymous message wrappers cannot reach a privileged client or transporter',async()=>{
 const h=harness({actor:null});assert.ok((await h.send(params)).error);assert.deepEqual(h.trace,[]);
});
test('foreign project, foreign booking, invisible profile and forged recipient cannot send or persist',async()=>{
 for(const options of [{denied:'Non autorisé'},{booking:{projet_id:'foreign',figurant_id:'candidate'}},{booking:{projet_id:'project',figurant_id:'foreign'}},{person:null}]){
  const h=harness(options);assert.ok((await h.send(params)).error);assert.ok(!h.trace.includes('persist'));assert.ok(!h.trace.includes('mail'));
 }
 const h=harness();assert.ok((await h.send({...params,email:'outsider@example.test'})).error);assert.ok(!h.trace.includes('persist'));
});
test('failed database insert never sends an email or push',async()=>{
 const h=harness({insertError:{message:'constraint'}});assert.ok((await h.send(params)).error);assert.deepEqual(h.trace,['admin','persist']);
});
test('SMTP failure preserves the candidate message and reports that partial result',async()=>{
 const h=harness({mailError:'SMTP fixture failure'});const result=await h.send(params);
 assert.equal(result.messageEnregistre,true);assert.match(result.error,/Message enregistré/);assert.equal(h.writes.length,1);assert.equal(h.writes[0].envoye_par,'staff');assert.deepEqual(h.trace,['admin','persist','push','mail']);
});
test('agent fallback and internal-only messages preserve existing supported flows',async()=>{
 const h=harness();assert.deepEqual(await h.send({...params,email:null,cc:'agent@example.test'}),{});assert.ok(h.trace.includes('mail'));
 const internal=harness();assert.deepEqual(await internal.send({...params,email:null}),{});assert.ok(internal.trace.includes('persist'));assert.ok(!internal.trace.includes('mail'));
});
function functions(path,names,context){
 const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');const ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
 const code=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).map(n=>n.getText(ast).replace(/^export\s+/,'' )).join('\n');
 assert.equal(ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).length,names.length);
 const js=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function(...Object.keys(context),js+`;return {${names.join(',')}};`)(...Object.values(context));
}
test('casting attachment resolves its stored role and project before Storage download',async()=>{
 for(const scenario of ['anonymous','foreign-project','denied','unknown']){
  let downloads=0,sends=0;
  const role=scenario==='unknown'?null:{id:'role',projet_id:scenario==='foreign-project'?'other':'project',pdf_storage_path:'role/file.pdf',pdf_filename:'stored.pdf'};
  const context={getCurrentProfile:async()=>scenario==='anonymous'?null:{id:'staff'},checkProjetAccess:async()=>scenario==='denied'?'Non autorisé':null,
   createAdminClient:()=>({from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:role,error:null})}),storage:{from:()=>({download:async()=>{downloads++;return{data:new Blob(['fixture'])};}})}}),
   recordFigurantMessage:async()=>{sends++;return{};},Buffer};
  const {recordCastingMessage}=functions('src/lib/casting/actions.ts',['roleAttachment','recordCastingMessage'],context);
  assert.ok((await recordCastingMessage('candidate','body',null,'subject','project',{rolePdfPath:'role/file.pdf'})).error);assert.equal(downloads,0);assert.equal(sends,0);
 }
});
