import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  }});
  const exports = {};
  new Function('require', 'exports', outputText)(name => name in mocks ? mocks[name] : require(name), exports);
  return exports;
}

test('global search does not create a privileged client for an anonymous caller', async () => {
  const { searchGlobal } = load('src/lib/search/actions.ts', {
    '@/lib/noms': {}, '@/lib/supabase/admin': {createAdminClient() {throw Error('privileged read');}},
    '@/lib/auth/session': {getCurrentProfile: async () => null},
    '@/lib/auth/sections': {}, '@/lib/figurants/comedien-privacy': {}, '@/lib/figurants/search-filter': {},
  });
  assert.deepEqual(await searchGlobal('Sacha'), []);
});

test('restricted assistants cannot search hidden sections', async () => {
  let reads = 0;
  const { searchGlobal } = load('src/lib/search/actions.ts', {
    '@/lib/noms': {}, '@/lib/supabase/admin': {createAdminClient: () => ({from() {reads++; throw Error('hidden section');}})},
    '@/lib/auth/session': {getCurrentProfile: async () => ({role:'assistant',sectionsAutorisees:[]}),getAccessibleProjetIds: async () => []},
    '@/lib/auth/sections': load('src/lib/auth/sections.ts'),
    '@/lib/figurants/comedien-privacy': {comedienPoolClause: () => 'pool'},
    '@/lib/figurants/search-filter': {buildProfileSearchFilter: () => 'name'},
  });
  assert.deepEqual(await searchGlobal('Sacha'), []);
  assert.equal(reads, 0);
});

test('test-mode email refuses even explicit project credentials without opening a transport', async () => {
  const { sendEmail, verifierBoiteEnvoi } = load('src/lib/email/send.ts', {
    'server-only': {}, '@/lib/communications-test': {communicationsDesactivees: () => true},
    nodemailer: {createTransport() {throw Error('real transport opened');}},
  });
  assert.ok((await sendEmail('fixture@example.test','Test','Test',{user:'fixture@example.test',pass:'dummy'})).error);
  assert.ok((await verifierBoiteEnvoi({user:'fixture@example.test',pass:'dummy'})).error);
});

test('test-mode blocks push and SMS relay before reading recipients', async () => {
  const mocks = {'server-only':{}, '@/lib/communications-test': {communicationsDesactivees: () => true},
    '@/lib/supabase/admin': {createAdminClient() {throw Error('recipient read');}},
    'web-push': {sendNotification() {throw Error('real push');}},
  };
  await load('src/lib/push/send.ts',mocks).sendPushToFigurant('fixture',{title:'test',body:'test'});
  assert.equal(await load('src/lib/textos/relais.ts',mocks).profilDuRelais(new Request('http://localhost',{headers:{authorization:'Bearer '+'x'.repeat(40)}})),null);
});

test('Field associates its label with generated or explicit input IDs', () => {
  const {Field,Input,Select} = load('src/components/ui/field.tsx', {'@/lib/cn':{cn:(...x)=>x.filter(Boolean).join(' ')}});
  for (const control of [React.createElement(Input,{name:'email'}),React.createElement(Select,{id:'fixed'})]) {
    const html=renderToStaticMarkup(React.createElement(Field,{label:'Coordonnées'},control));
    const labelId=html.match(/for="([^"]+)"/)[1];
    assert.ok(html.includes(`id="${labelId}"`));
  }
});


test('global anonymisation refuses a non-owner before any privileged mutation', async () => {
  const { anonymiserFigurant } = load('src/lib/rgpd/actions.ts', {
    'next/cache': {},
    '@/lib/auth/session': {requireChef: async () => ({isOwner:false})},
    '@/lib/supabase/admin': {createAdminClient() {throw Error('privileged mutation');}},
  });
  assert.ok((await anonymiserFigurant('fixture')).error);
});
