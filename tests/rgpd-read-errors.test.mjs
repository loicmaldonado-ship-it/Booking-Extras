import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/rgpd/data.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(failure){const db={from(table){const q={select(){return this},eq(){return this},in(){return this},then(ok,bad){let data=table==='figurants'?[{id:'person',prenom:'Test',nom:'Fictif',email:null,updated_at:'2020-01-01',anonymisation_en_cours_at:null}]:table==='bookings'?[{figurant_id:'person',date:'2026-10-01'}]:[];return Promise.resolve({data:failure===table?null:data,error:failure===table?{message:'offline'}:null}).then(ok,bad)}};return q}};const exports={};new Function('require','exports',code)(n=>n==='@/lib/supabase/admin'?{createAdminClient:()=>db}:n==='@/lib/auth/session'?{getCurrentProfile:async()=>({isOwner:true,role:'chef'})}:{},exports);return exports.getFigurantsInactifs}
for(const failure of ['figurants','bookings','candidatures'])test(`inactivity lookup fails closed when ${failure} cannot be read`,async()=>{await assert.rejects(fixture(failure)(3),/indisponible/i)});
test('recent booking prevents a person being listed as inactive',async()=>{assert.deepEqual(await fixture()(3),[])});
