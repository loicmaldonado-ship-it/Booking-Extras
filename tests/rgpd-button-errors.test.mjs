import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
function harness(result){
 const states=[];let index=0,refreshes=0,work;
 const mocks={'react/jsx-runtime':jsx,'react':{useState(initial){const current=index++;if(!(current in states))states[current]=initial;return[states[current],value=>{states[current]=value;}];},useTransition:()=>[false,callback=>{work=callback();}]},'next/navigation':{useRouter:()=>({refresh:()=>refreshes++})},'@/components/ui/button':{Button:()=>null},'@/lib/rgpd/actions':{anonymiserFigurant:async()=>{if(result instanceof Error)throw result;return result;}}};
 const source=readFileSync(new URL('../src/components/rgpd/anonymiser-button.tsx',import.meta.url),'utf8');const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{assert.ok(name in mocks,name);return mocks[name];},exports);
 const render=()=>{index=0;return exports.AnonymiserButton({figurantId:'fixture',nom:'Profil fictif'});};
 const find=(node,predicate)=>{if(!node)return null;if(Array.isArray(node)){for(const child of node){const found=find(child,predicate);if(found)return found;}return null;}if(typeof node!=='object')return null;if(predicate(node))return node;return find(node.props?.children,predicate);};
 return{async confirm(){find(render(),n=>n.props?.title==='Anonymiser Profil fictif').props.onClick();find(render(),n=>n.props?.children==='Oui, anonymiser').props.onClick();await work;},alert:()=>find(render(),n=>n.props?.role==='alert')?.props.children,refreshes:()=>refreshes};
}
test('anonymisation displays a returned cleanup error instead of refreshing as if it succeeded',async()=>{const h=harness({error:'Nettoyage incomplet — fixture'});await h.confirm();assert.equal(h.alert(),'Nettoyage incomplet — fixture');assert.equal(h.refreshes(),0);});
test('anonymisation displays an interruption without claiming success',async()=>{const h=harness(new Error('fixture interruption'));await h.confirm();assert.match(h.alert(),/Aucune réussite confirmée/);assert.equal(h.refreshes(),0);});
test('only successful anonymisation refreshes the profile list',async()=>{const h=harness({success:true});await h.confirm();assert.equal(h.refreshes(),1);assert.equal(h.alert(),undefined);});
