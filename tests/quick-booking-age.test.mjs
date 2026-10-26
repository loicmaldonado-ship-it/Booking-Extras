import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {ageOnDate} from '../src/lib/minors/model.ts';
function action(existing){
 const builder={select(){return this;},ilike(){return this;},eq(){return this;},limit(){return this;},maybeSingle:async()=>({data:existing?{id:'existing'}:null}),single:async()=>({data:existing?{prenom:'Fictif',nom:'Test',date_naissance:null}:null}),insert(){throw Error('aucune création avant validation âge');}};
 const mocks={'next/cache':{},'@/lib/minors/model':{ageOnDate},'@/lib/auth/session':{checkProjetAccess:async()=>null},'@/lib/supabase/admin':{createAdminClient:()=>({from:table=>table==='bookings'?{...builder,maybeSingle:async()=>({data:null})}:builder})},'@/lib/figurants/photos':{},'@/lib/candidats/invitation':{},'@/lib/candidatures/types':{CACHETS:['figuration']},'@/lib/figurants/doublons':{doublonsProbables:async()=>[]}};
 const source=readFileSync(new URL('../src/lib/bookings/ajout-rapide-actions.ts',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{assert.ok(name in mocks,name);return mocks[name];},exports);return exports.ajoutRapideBooking;
}
function form(birth){const fd=new FormData();fd.set('prenom','Test');fd.set('nom','Fictif');fd.set('email','test@example.test');if(birth)fd.set('date_naissance',birth);return fd;}
test('quick booking refuses a new profile without birth before creating it',async()=>{const r=await action(false)('project','2026-11-05','Figuration','figuration',form());assert.match(r.error,/date de naissance valide/);});
test('quick booking directs a new minor to the legal dossier before creating a booking',async()=>{const r=await action(false)('project','2026-11-05','Figuration','figuration',form('2012-01-01'));assert.match(r.error,/dossier.*Mineurs/);});
test('quick booking requires editing an existing profile whose birth is absent',async()=>{const r=await action(true)('project','2026-11-05','Figuration','figuration',form('1990-01-01'));assert.match(r.error,/fiche profil/);});
