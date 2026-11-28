import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import {isPrivateStorageImage} from '../src/lib/media/private-image.ts';
const require=createRequire(import.meta.url);
function load(path,mocks={},env=process.env){const code=ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const exports={};new Function('require','exports','process',code)(name=>name in mocks?mocks[name]:require(name),exports,{env});return exports;}
test('private Storage image URLs are distinguished from public, static and preview sources',()=>{
 for(const path of ['object/sign','render/image/sign','object/authenticated'])assert.equal(isPrivateStorageImage('https://project.supabase.co/storage/v1/'+path+'/photos/fixture.jpg?token=fixture'),true);
 for(const src of ['https://project.supabase.co/storage/v1/object/public/avatars/fixture.jpg','/icon.png','blob:http://localhost/fixture','data:image/png;base64,fixture',null,{src:'/static.png'}])assert.equal(isPrivateStorageImage(src),false);
});
test('image component forces private images to bypass public optimisation while preserving public image props',()=>{
 const Image=load('src/components/ui/image.tsx',{'react/jsx-runtime':jsx,'next/image':function NextImage(){},'@/lib/media/private-image':{isPrivateStorageImage}}).default;
 const privateImage=Image({src:'https://project.supabase.co/storage/v1/object/sign/photos/fixture.png?token=test',alt:'Photo',width:64,height:64,unoptimized:false});assert.equal(privateImage.props.unoptimized,true);assert.equal(privateImage.props.alt,'Photo');assert.equal(privateImage.props.width,64);
 const publicImage=Image({src:'https://project.supabase.co/storage/v1/object/public/avatars/fixture.png',alt:'Avatar',width:64,height:64});assert.equal(publicImage.props.unoptimized,undefined);
 assert.equal(Image({src:'/preview.png',alt:'Aperçu',unoptimized:true}).props.unoptimized,true);
});
test('the actual Next matcher refuses signed paths even for a manually forged optimizer URL',()=>{
 const {hasRemoteMatch}=require('next/dist/shared/lib/match-remote-pattern');
 for(const backend of ['https://project.supabase.co','http://127.0.0.1:27194']){
  const config=load('next.config.ts',{}, {NODE_ENV:'production',BOOKING_TEST_MODE:'1',NEXT_PUBLIC_SUPABASE_URL:backend}).default;
  assert.equal(hasRemoteMatch([],config.images.remotePatterns,new URL(backend+'/storage/v1/object/public/avatars/fixture.png')),true);
  for(const path of ['object/sign','render/image/sign','object/authenticated'])assert.equal(hasRemoteMatch([],config.images.remotePatterns,new URL(backend+'/storage/v1/'+path+'/photos/fixture.png?token=test')),false);
 }
});
