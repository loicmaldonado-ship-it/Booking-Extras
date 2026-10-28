import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/messages/envois-actions.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(failure){const refresh=[];const db={from(table){let op='read';const q={insert(){op='insert';return this},delete(){op='delete';return this},select(){return this},eq(){return this},single(){return Promise.resolve({data:{id:'new'},error:null})},then(ok,bad){const error=(table==='envoi_destinataires'&&op==='insert')||(failure==='cleanup'&&table==='envois'&&op==='delete');return Promise.resolve({data:[],error:error?{message:'offline'}:null}).then(ok,bad)}};return q}};const exports={};new Function('require','exports',code)(n=>n==='@/lib/supabase/admin'?{createAdminClient:()=>db}:n==='@/lib/auth/session'?{checkProjetAccess:async()=>null,getCurrentProfile:async()=>({id:'staff'})}:n==='next/cache'?{revalidatePath:p=>refresh.push(p)}:{},exports);return{action:exports.creerEnvoi,refresh}}
const params={projetId:'project',date:'2026-11-11',titre:'Test',sujet:'Test',corps:'Test',canal:'email',avecAccuse:false,destinataires:[{figurantId:'person',bookingId:'booking'}]};
test('failed recipient creation with failed cleanup reports partial creation',async()=>{const f=fixture('cleanup');const r=await f.action(params);assert.match(r.error,/suivi.*créé/i);assert.ok(f.refresh.includes('/bookings/documents'))});
