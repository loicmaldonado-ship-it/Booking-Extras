import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/agents/actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function harness({reads=[],writeError=null,updated=[{id:'existing'}],actor={isOwner:true}}={}){
 const writes=[],revalidates=[];let clients=0;
 const db={from(table){assert.equal(table,'agents');let op='read';const q={
  select(){return q;},ilike(){return q;},eq(){return q;},
  maybeSingle:async()=>reads.shift()??{data:null,error:null},
  insert(value){op='insert';writes.push({op,value});return q;},
  update(value){op='update';writes.push({op,value});return q;},
  delete(){op='delete';writes.push({op});return q;},
  then(resolve,reject){return Promise.resolve({data:op==='update'?updated:null,error:writeError}).then(resolve,reject);}
 };return q;}};
 const mocks={'next/cache':{revalidatePath:path=>revalidates.push(path)},'@/lib/supabase/admin':{createAdminClient:()=>{clients++;return db;}},'@/lib/auth/session':{getCurrentProfile:async()=>actor},'@/lib/auth/owner':{isOwner:p=>!!p?.isOwner}};
 const actions={};new Function('require','exports',code)(name=>{assert.ok(name in mocks,name);return mocks[name];},actions);
 return {actions,writes,revalidates,clients:()=>clients};
}
const value={nom:'Fixture',email:'fixture@example.test'};
test('agent email lookup failure cannot fall through into an insert',async()=>{
 const h=harness({reads:[{data:null,error:{message:'read refused'}}]});assert.ok((await h.actions.upsertAgent(value)).error);assert.equal(h.writes.length,0);
});
test('agent name lookup failure aborts rather than creating another ambiguous record',async()=>{
 const h=harness({reads:[{data:null,error:null},{data:null,error:{message:'multiple matches'}}]});assert.ok((await h.actions.upsertAgent(value)).error);assert.equal(h.writes.length,0);
});
test('agent insert failure is returned to the caller',async()=>{
 const h=harness({writeError:{message:'insert refused'}});assert.ok((await h.actions.upsertAgent(value)).error);assert.deepEqual(h.writes.map(x=>x.op),['insert']);
});
test('agent update failure and disappearing row never report a completed save',async()=>{
 for(const extra of [{writeError:{message:'update refused'}},{updated:[]}]){
  const h=harness({reads:[{data:{id:'existing'},error:null}],...extra});assert.ok((await h.actions.upsertAgent(value)).error);assert.deepEqual(h.writes.map(x=>x.op),['update']);
 }
});
test('agent deletion failure does not report success or refresh the list',async()=>{
 const h=harness({writeError:{message:'delete refused'}});const r=await h.actions.deleteAgent('fixture');assert.ok(r.error);assert.notEqual(r.success,true);assert.equal(h.revalidates.length,0);
});
test('normal agent save and deletion preserve success behavior',async()=>{
 const h=harness();assert.deepEqual(await h.actions.upsertAgent(value),{});assert.equal((await h.actions.deleteAgent('fixture')).success,true);assert.deepEqual(h.revalidates,['/admin/agents']);
});
test('anonymous save and non-owner delete are rejected before privileged access',async()=>{
 const anonymous=harness({actor:null});assert.ok((await anonymous.actions.upsertAgent(value)).error);assert.equal(anonymous.clients(),0);
 const staff=harness({actor:{isOwner:false}});assert.ok((await staff.actions.deleteAgent('fixture')).error);assert.equal(staff.clients(),0);
});
