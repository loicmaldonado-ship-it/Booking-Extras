import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {renderToStaticMarkup} from 'react-dom/server';
function page({valid=true}={}){
 const signed=[];let admins=0;
 const mocks={'react/jsx-runtime':jsxRuntime,
  'next/navigation':{notFound:()=>{throw Error('NOT_FOUND');}},
  '@/components/ui/card':{Card:({children})=>React.createElement('div',null,children)},
  '@/lib/minors/model':{todayInParis:()=> '2026-10-26'},
  '@/lib/minors/dossiers':{bearerDossier:async()=>valid?{dossier:{id:'dossier',projet_id:'project',figurant_id:'child',tournage_debut:'2026-11-05'},age:14,child:{prenom:'Zoé',nom:'Test',email:'child-private@example.test'}}:null,signedMinorFile:async path=>{signed.push(path);return 'https://download.example.test/'+path;}},
  '@/lib/supabase/admin':{createAdminClient:()=>{admins++;return{
   from:table=>({select(){return this;},eq(){return this;},returns:async()=>({data:[
    {id:'allowed-parent',source_key:'guardian_1',state:'validated',storage_path:'current-parent.pdf',guardian_fingerprint:'current',valid_until:null,internal_note:'NE JAMAIS PARTAGER NOTE INTERNE'},
    {id:'stale-parent',source_key:'guardian_2',state:'validated',storage_path:'stale-parent.pdf',guardian_fingerprint:null,valid_until:null},
    {id:'expired',source_key:'extra_expired',state:'validated',storage_path:'expired.pdf',valid_until:'2026-10-30'},
    {id:'inactive',source_key:'extra_inactive',state:'validated',storage_path:'inactive.pdf',valid_until:null},
    {id:'allowed-extra',source_key:'extra_current',state:'validated',storage_path:'current-extra.pdf',valid_until:'2027-01-01'},
   ],error:null}),then(resolve){return Promise.resolve({data:[{id:'expired',label:'Pièce expirée'},{id:'current',label:'Certificat scolaire'}],error:null}).then(resolve);}}),
   rpc:async(name,args)=>({data:args.p_position===1?'current':null,error:null}),
  };}},
 };
 const source=readFileSync(new URL('../src/app/mineurs/partage/[token]/page.tsx',import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{assert.ok(name in mocks,name);return mocks[name];},exports);
 return {render:exports.default,signed,admins:()=>admins};
}
test('production share signs only current active documents and never renders internal notes or child email',async()=>{
 const h=page();const html=renderToStaticMarkup(await h.render({params:Promise.resolve({token:'test-token'})}));
 assert.deepEqual(h.signed,['current-parent.pdf','current-extra.pdf']);
 assert.ok(html.includes('Certificat scolaire'));assert.ok(html.includes('Autorisation parentale 1'));
 for(const secret of ['NE JAMAIS PARTAGER','child-private@example.test','stale-parent.pdf','expired.pdf','inactive.pdf'])assert.ok(!html.includes(secret),secret);
});
test('invalid production share stops before any file signing or privileged query',async()=>{
 const h=page({valid:false});await assert.rejects(()=>h.render({params:Promise.resolve({token:'invalid'})}),/NOT_FOUND/);assert.equal(h.admins(),0);assert.deepEqual(h.signed,[]);
});
