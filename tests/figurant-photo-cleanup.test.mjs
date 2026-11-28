import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/figurants/photos.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function fixture(cleanupFails){const removed=[];const db={storage:{from(){return{upload:async()=>({error:null}),remove:async paths=>{removed.push(...paths);return{error:cleanupFails?{message:'offline'}:null}}}}},from(){return{insert(){return this},select(){return this},single:async()=>({data:null,error:{message:'constraint'}})}}};const exports={};new Function('require','exports',code)(n=>n==='@/lib/media/validate-upload'?{validateImageUpload:async()=>({extension:'jpg',mimeType:'image/jpeg'})}:{},exports);return{action:exports.insertFigurantPhoto,db,removed}}
test('failed photo database insert attempts to clean uploaded file',async()=>{const f=fixture(false);const r=await f.action(f.db,'person','portrait',new File(['test'],'test.jpg',{type:'image/jpeg'}));assert.ok(r.error);assert.equal(f.removed.length,1)});
test('failed photo cleanup is reported explicitly',async()=>{const f=fixture(true);const r=await f.action(f.db,'person','portrait',new File(['test'],'test.jpg',{type:'image/jpeg'}));assert.match(r.error,/nettoyage.*stockage/i);assert.equal(f.removed.length,1)});
test('failed photo count is not treated as zero',async()=>{const q={select(){return this},eq(){return Promise.resolve({count:null,error:{message:'offline'}})}};const exports={};new Function('require','exports',code)(()=>({}),exports);assert.equal(await exports.countFigurantPhotos({from:()=>q},'person'),null)});
