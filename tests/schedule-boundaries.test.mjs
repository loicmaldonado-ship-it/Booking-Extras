import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
function loadFunctions(path,names,context){
 const source=readFileSync(new URL('../'+path,import.meta.url),'utf8'),ast=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
 const declarations=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text));assert.equal(declarations.length,names.length);
 const code=ts.transpileModule(declarations.map(n=>n.getText(ast).replace(/^export\s+/,'' )).join('\n'),{compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function(...Object.keys(context),code+`;return {${names.join(',')}};`)(...Object.values(context));
}
for(const [path,fn,,slot,day,guard] of [
 ['src/lib/essayages/actions.ts','assignFigurantToCreneau','essayages','essayage_creneaux','essayage_journee_id','checkEssayageAccess'],
 ['src/lib/casting-presentiel/actions.ts','assignPresentielEntryToCreneau','casting_presentiel_entries','casting_presentiel_creneaux','journee_id','checkEntryAccess'],
]){
 test(`${fn}: foreign day and failed lookups cannot write; same day and clearing remain supported`,async()=>{
  for(const scenario of ['foreign','lookup-error','same','clear','update-error']){
   let writes=0;
   const context={[guard]:async()=>null,revalidatePath:()=>{},createAdminClient:()=>({from(table){return {
    select(){return this;},eq(){return this;},
    maybeSingle:async()=>({data:{[day]:table===slot&&scenario==='foreign'?'B':'A'},error:scenario==='lookup-error'?{message:'lookup'}:null}),
    update:()=>({eq:async()=>{writes++;return{error:scenario==='update-error'?{message:'constraint'}:null};}}),
   };}})};
   const method=loadFunctions(path,[fn],context)[fn];const result=await method('entry',scenario==='clear'?null:'slot');
   if(['foreign','lookup-error'].includes(scenario)){assert.ok(result.error);assert.equal(writes,0);}
   else if(scenario==='update-error'){assert.ok(result.error);assert.equal(writes,1);}
   else{assert.ok(!result?.error);assert.equal(writes,1);}
  }
 });
}
test('bulk fitting move rejects foreign, missing and duplicate IDs before creating a target day',async()=>{
 for(const scenario of ['foreign','missing','duplicate','lookup-error']){
  let dayAccesses=0,writes=0;
  const row={id:'fitting',figurant_id:'candidate',projet_id:scenario==='foreign'?'other':'project'};
  const context={checkProjetAccess:async()=>null,revalidatePath:()=>{},createAdminClient:()=>({from(table){
   if(table!=='essayages')dayAccesses++;
   return{select(){return this;},in:async()=>({data:scenario==='missing'?[]:[row],error:scenario==='lookup-error'?{message:'lookup'}:null}),insert(){writes++;throw Error('unexpected write');}};
  }})};
  const {moveEssayagesToJournee}=loadFunctions('src/lib/essayages/actions.ts',['moveEssayagesToJournee'],context);
  assert.ok((await moveEssayagesToJournee(scenario==='duplicate'?['fitting','fitting']:['fitting'],'project','2026-11-07',null)).error);
  assert.equal(dayAccesses,0);assert.equal(writes,0);
 }
});
