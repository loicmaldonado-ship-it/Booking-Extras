import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';
import {createClient} from '@supabase/supabase-js';
const backend=new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);assert.equal(process.env.BOOKING_TEST_MODE,'1');assert.equal(backend.origin,'http://127.0.0.1:28194');
const base=process.env.BOOKING_SUPABASE_WORKDIR;assert.ok(base?.endsWith('/validation-casting-180'));assert.match(readFileSync(join(base,'supabase/config.toml'),'utf8'),/project_id = "booking-casting-180-20261026"/);
const cli='/Users/eleagravagna/.npm/_npx/91eb58246759989d/node_modules/@supabase/cli-darwin-x64/bin/supabase';
const db=createClient(backend.href,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const ok=r=>{assert.ifError(r.error);return r.data;};
const owner=ok(await db.from('profiles').select('id,is_owner').eq('id','00000000-0000-4000-8000-00000000c0c0').single());assert.equal(owner.is_owner,true);
const prefix='agent-failure-'+randomUUID(),fixture='agents_fault_'+randomUUID().replaceAll('-',''),scratch=mkdtempSync(join(tmpdir(),'booking-agent-fail-'));let createdPerson=null,invalidations=0;
const session={'getCurrentProfile':async()=>({id:owner.id,isOwner:owner.is_owner})};
function load(source,mocks){const exports={};const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','exports',code)(name=>{assert.ok(name in mocks,name);return mocks[name];},exports);return exports;}
const shared={'next/cache':{revalidatePath:()=>{invalidations++;}},'next/navigation':{redirect:()=>{throw Error('Unexpected full success redirect');}},'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/auth/session':session,'@/lib/auth/owner':{isOwner:p=>!!p?.isOwner}};
const current=load(readFileSync(new URL('../src/lib/agents/actions.ts',import.meta.url),'utf8'),shared);
const oldSource=spawnSync('git',['show','489b6bb:src/lib/agents/actions.ts'],{encoding:'utf8'});assert.equal(oldSource.status,0);
const old=load(oldSource.stdout,shared);
const people=load(readFileSync(new URL('../src/lib/figurants/actions.ts',import.meta.url),'utf8'),{...shared,'@/lib/agents/actions':current,'@/lib/supabase/server':{createServerSupabaseClient:async()=>db},'@/lib/media/validate-upload':{},'./photos':{},'@/lib/figurants/comedien-privacy':{comedienPoolIdFor:p=>p.id}});
function sql(text){const file=join(scratch,'fixture.sql');writeFileSync(file,text);const result=spawnSync(cli,['db','query','--local','--file',file],{cwd:base,encoding:'utf8'});assert.equal(result.status,0,result.stdout+result.stderr);assert.equal(result.stdout.trim(),'DO',result.stdout);}
const clear=`DO $clear$ BEGIN DROP TRIGGER IF EXISTS ${fixture} ON public.agents; DROP FUNCTION IF EXISTS public.${fixture}(); END $clear$;`;
try{
 const victim=ok(await db.from('agents').insert({nom:prefix+'-original',agence:'Original fixture'}).select('id').single());
 sql(`DO $setup$ BEGIN CREATE FUNCTION public.${fixture}() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$ BEGIN IF coalesce(NEW.nom,OLD.nom) LIKE '${prefix}%' THEN RAISE EXCEPTION 'Fixture agents write refused' USING ERRCODE='ZX003'; END IF; IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW; END $fn$; REVOKE ALL ON FUNCTION public.${fixture}() FROM public,anon,authenticated; CREATE TRIGGER ${fixture} BEFORE INSERT OR UPDATE OR DELETE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.${fixture}(); END $setup$;`);
 assert.equal((await old.deleteAgent(victim.id)).success,true);assert.equal(ok(await db.from('agents').select('id').eq('id',victim.id)).length,1);
 assert.equal(await old.upsertAgent({nom:prefix+'-old-insert'}),undefined);assert.equal(ok(await db.from('agents').select('id').eq('nom',prefix+'-old-insert')).length,0);
 console.log('REPRODUCED old code: delete success despite preserved row; failed upsert silently returned');
 const before=invalidations;assert.ok((await current.deleteAgent(victim.id)).error);assert.equal(invalidations,before);assert.equal(ok(await db.from('agents').select('id').eq('id',victim.id)).length,1);
 assert.ok((await current.upsertAgent({nom:prefix+'-new-insert'})).error);
 assert.ok((await current.upsertAgent({nom:prefix+'-original',agence:'Wrong overwrite'})).error);assert.equal(ok(await db.from('agents').select('agence').eq('id',victim.id).single()).agence,'Original fixture');
 const form=new FormData();form.set('prenom','Partial fixture');form.set('nom',prefix);form.set('est_comedien','on');form.set('agent_nom',prefix+'-directory');form.set('lien_label','Fixture');form.set('lien_url','https://example.test');
 const partial=await people.createFigurant(null,form);createdPerson=partial.createdFigurantId;assert.ok(partial.error&&createdPerson);assert.equal(ok(await db.from('figurants').select('id').eq('id',createdPerson)).length,1);assert.equal(ok(await db.from('figurant_liens').select('id').eq('figurant_id',createdPerson)).length,0);
 console.log('PASS write refusals returned, no false deletion/revalidation; partial profile response includes its saved id and explicitly stops before links');
 sql(clear);
 const ambiguousEmail=prefix+'@example.test';ok(await db.from('agents').insert([{nom:prefix+'-a',email:ambiguousEmail},{nom:prefix+'-b',email:ambiguousEmail}]));
 const count=ok(await db.from('agents').select('id').ilike('nom',prefix+'%')).length;assert.ok((await current.upsertAgent({nom:prefix+'-must-not-create',email:ambiguousEmail})).error);assert.equal(ok(await db.from('agents').select('id').ilike('nom',prefix+'%')).length,count);
 ok(await db.from('agents').insert([{nom:prefix+'-same'},{nom:prefix+'-same'}]));assert.ok((await current.upsertAgent({nom:prefix+'-same'})).error);
 assert.equal((await current.deleteAgent(victim.id)).success,true);assert.equal(ok(await db.from('agents').select('id').eq('id',victim.id)).length,0);
 console.log('PASS ambiguous email/name lookup aborts before writes; normal deletion succeeds after fixture refusal removed');
}finally{
 sql(clear);if(createdPerson)ok(await db.from('figurants').delete().eq('id',createdPerson));ok(await db.from('agents').delete().ilike('nom',prefix+'%'));rmSync(scratch,{recursive:true,force:true});console.log('Cleanup only fictional rows and temporary failure trigger/function');
}
