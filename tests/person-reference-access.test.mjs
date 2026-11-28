import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const id=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
function harness(answer){
 let clients=0;const batches=[];
 const code=ts.transpileModule(readFileSync(new URL('../src/lib/figurants/access.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{
  if(name==='server-only')return {};
  assert.equal(name,'@/lib/supabase/server');
  return {
   createServerSupabaseClient: async () => {
    clients++;
    return {
     from: table => {
      assert.equal(table, 'figurants');
      return {
       select: columns => {
        assert.equal(columns, 'id');
        return {
         in: async (column, values) => {
          assert.equal(column, 'id');
          batches.push(values);
          return answer(values);
         }
        };
       }
      };
     }
    };
   }
  };
 },exports);
 return {check:exports.checkVisibleFigurants,batches,clients:()=>clients};
}
test('person access rejects malformed and oversized selections before touching a client',async()=>{
 const h=harness(()=>{throw Error('client must not be used');});
 for(const value of [null,[null],['forged'],Array(1501).fill(id(1))])assert.ok(await h.check(value));
 assert.equal(h.clients(),0);
});
test('person access fails closed on a missing row or database error',async()=>{
 for(const answer of [()=>({data:[],error:null}),()=>({data:null,error:{message:'unavailable'}})]){
  const h=harness(answer);assert.ok(await h.check([id(1)]));assert.equal(h.clients(),1);
 }
});
test('person access preserves large valid drops without relying on the API 1000-row cap',async()=>{
 const h=harness(values=>({data:values.map(id=>({id})),error:null}));
 assert.equal(await h.check(Array.from({length:1201},(_,n)=>id(n))),null);
 assert.deepEqual(h.batches.map(x=>x.length),[400,400,400,1]);
});
test('person access deduplicates case-insensitive ids and does not query empty selections',async()=>{
 const h=harness(values=>({data:values.map(id=>({id})),error:null}));
 assert.equal(await h.check([]),null);assert.equal(h.clients(),0);
 const value='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';assert.equal(await h.check([value,value.toUpperCase()]),null);assert.equal(h.batches[0].length,1);
});
