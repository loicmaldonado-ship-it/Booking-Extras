import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {readGuardians} from '../src/lib/minors/model.ts';
const source=readFileSync(new URL('../src/lib/candidats/actions.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('actions.ts',source,ts.ScriptTarget.Latest,true);
const functions=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&['str','num','buildVehiculePayload','updateMaFiche'].includes(n.name?.text)).map(n=>n.getText(ast).replace(/^export\s+/,'')).join('\n');
const js=ts.transpileModule(functions,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function harness({session={id:'self'},identityError=null}={}){
 const writes=[];let admins=0;
 const context={getCurrentFigurant:async()=>session,readGuardians,createAdminClient:()=>{admins++;return{
  rpc:async(name,payload)=>{writes.push({name,payload});return{error:identityError};},
  from:table=>({update:payload=>({eq:async(key,id)=>{writes.push({table,payload,key,id});return{error:null};}})})
 };},upsertFigurantLienByLabel:async()=>({}),revalidatePath:()=>{},LIEN_BANDE_DEMO:'demo',LIEN_INSTAGRAM:'instagram'};
 return {writes,admins:()=>admins,save:new Function(...Object.keys(context),js+';return updateMaFiche;')(...Object.values(context))};
}
function form(){const fd=new FormData();for(const [k,v] of Object.entries({id:'forged-foreign-id',email:'child@example.test',telephone:'0600000001',ville:'Paris',adresse:'1 rue de Test',code_postal:'75011',commune_naissance:'Paris',genre:'Autre',pronom:'Iel',date_naissance:'2010-01-01'}))fd.set(k,v);return fd;}
function withParents(fd){for(const [k,v] of Object.entries({prenom:'Parent',nom:'Test',adresse:'2 rue de Test',telephone:'0600000002',email:'parent@example.test'}))fd.set('guardian_1_'+k,v);fd.set('guardian_2_absence_reason','decede');return fd;}
test('candidate identity update refuses anonymous access and incomplete minor representatives before a privileged write',async()=>{
 const anonymous=harness({session:null});assert.ok((await anonymous.save(null,form())).error);assert.equal(anonymous.admins(),0);
 const incomplete=harness();assert.ok((await incomplete.save(null,form())).error);assert.equal(incomplete.admins(),0);
});
test('a forged candidate id cannot modify another identity or profile',async()=>{
 const h=harness();assert.deepEqual(await h.save(null,withParents(form())),{success:true});
 assert.equal(h.writes[0].name,'update_candidate_identity');assert.equal(h.writes[0].payload.p_id,'self');
 assert.equal(h.writes[1].id,'self');assert.equal(h.writes[1].key,'id');
 assert.ok(!('email' in h.writes[1].payload));assert.ok(!('date_naissance' in h.writes[1].payload));
});
test('a failed atomic identity save cannot continue into profile writes',async()=>{
 const h=harness({identityError:{message:'fixture failure'}});assert.ok((await h.save(null,withParents(form()))).error);assert.equal(h.writes.length,1);
});
