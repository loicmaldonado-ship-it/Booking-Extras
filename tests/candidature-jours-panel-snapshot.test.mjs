import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=readFileSync(new URL('../src/lib/candidatures/jours-panel-snapshot.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};runInNewContext(compiled,{exports});
test('a sent day is marked while other available days remain selectable',()=>{
 const selected=[{id:'one',nom:'Test',jours:[{id:'d1',disponible:true,dansLaJournee:false},{id:'d2',disponible:true,dansLaJournee:false}]}];
 const result=exports.marquerJoursEnvoyes(selected,'d1',['one']);
 assert.equal(result[0].jours[0].dansLaJournee,true);assert.equal(result[0].jours[1].disponible,true);assert.equal(result[0].jours[1].dansLaJournee,false);assert.equal(selected[0].jours[0].dansLaJournee,false);
});
