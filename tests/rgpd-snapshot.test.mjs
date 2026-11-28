import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/rgpd/data.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(actor,response){let calls=0;const db={rpc:async(name,args)=>{calls++;assert.equal(name,'rgpd_lister_profils_inactifs_snapshot');assert.match(args.p_seuil,/^\d{4}-\d{2}-\d{2}$/);return response}};const exports={};new Function('require','exports',code)(n=>n==='@/lib/supabase/admin'?{createAdminClient:()=>db}:n==='@/lib/auth/session'?{getCurrentProfile:async()=>actor}:{},exports);return{run:exports.getFigurantsInactifs,calls:()=>calls}}
const owner={isOwner:true,role:'chef'};
test('unauthorized user never calls the retention snapshot',async()=>{const f=fixture({role:'assistant'},{});assert.deepEqual(await f.run(3),[]);assert.equal(f.calls(),0)});
test('unavailable and malformed snapshots do not expose a partial list',async()=>{for(const res of [{data:null,error:{message:'offline'}},{data:null,error:null},{data:{},error:null},{data:[{id:'person'}],error:null}]){const f=fixture(owner,res);await assert.rejects(f.run(3),/indisponible/i)}});
test('valid snapshot returns inactive records',async()=>{const data=[{id:'fictif',prenom:'Test',nom:'Test',email:null,derniereActivite:'2020-01-01',effacementEnCours:false}];const f=fixture(owner,{data,error:null});assert.deepEqual(await f.run(3),data);assert.equal(f.calls(),1)});
