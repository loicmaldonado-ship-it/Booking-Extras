import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');

// Charge src/lib/figurants/actions.ts avec des dépendances simulées : la base est un faux client
// qui enregistre les écritures, pour vérifier qui peut changer l'email d'une personne.
function charger(profil, fiche) {
  const exports = {};
  const ecritures = [];
  const code = ts.transpileModule(readFileSync(new URL('../src/lib/figurants/actions.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const lecture = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: fiche, error: null }) };
  const admin = {
    from: () => ({
      select() { return this; },
      eq() { return this; },
      maybeSingle: async () => ({ data: fiche, error: null }),
      update(valeurs) { ecritures.push(valeurs); return { eq: async () => ({ error: null }) }; },
    }),
  };
  const mocks = {
    '@/lib/auth/session': { getCurrentProfile: async () => profil },
    '@/lib/supabase/server': { createServerSupabaseClient: async () => ({ from: () => lecture }) },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/figurants/comedien-privacy': { comedienPoolIdFor: () => null },
    '@/lib/agents/upsert': { upsertAgent: async () => ({}) },
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect() { throw new Error('redirect'); } },
  };
  runInNewContext(code, {
    exports, process: { env: {} }, Date, File, Buffer, console,
    require(nom) {
      if (nom in mocks) return mocks[nom];
      if (nom === 'server-only') return {};
      return new Proxy({}, { get: (_c, cle) => (cle === '__esModule' ? false : () => ({})) });
    },
  });
  return { actions: exports, ecritures };
}

function formulaire(email, extra = {}) {
  const fd = new FormData();
  const base = { prenom: 'Lou', nom: 'Essai', email, telephone: '0600000000', adresse: '1 rue test', code_postal: '75001', ville: 'Paris', commune_naissance: 'Paris', genre: 'femme', pronom: 'elle', ...extra };
  for (const [k, v] of Object.entries(base)) if (v !== undefined) fd.set(k, v);
  return fd;
}
const compte = { email: 'lou@example.test', est_comedien: false, acces_compte: true, comedien_pool_id: null };

test('une cheffe non propriétaire ne peut pas changer l\'email d\'une personne qui a un compte candidat', async () => {
  const { actions, ecritures } = charger({ id: 'c2', role: 'chef', isOwner: false }, compte);
  const r = await actions.updateFigurantInline('p1', null, formulaire('autre@example.test'));
  assert.match(r.error, /compte candidat/);
  assert.equal(ecritures.length, 0);
});

test('une assistante ne peut pas non plus changer cet email', async () => {
  const { actions, ecritures } = charger({ id: 'a1', role: 'assistant', isOwner: false }, compte);
  const r = await actions.updateFigurantInline('p1', null, formulaire('autre@example.test'));
  assert.match(r.error, /compte candidat/);
  assert.equal(ecritures.length, 0);
});

test('le compte propriétaire peut changer cet email', async () => {
  const { actions, ecritures } = charger({ id: 'o', role: 'chef', isOwner: true }, compte);
  const r = await actions.updateFigurantInline('p1', null, formulaire('autre@example.test'));
  assert.ok(!r?.error, r?.error);
  assert.equal(ecritures.length, 1);
  assert.equal(ecritures[0].email, 'autre@example.test');
});

test('une cheffe non propriétaire peut modifier les autres champs sans toucher à l\'email', async () => {
  const { actions, ecritures } = charger({ id: 'c2', role: 'chef', isOwner: false }, compte);
  const r = await actions.updateFigurantInline('p1', null, formulaire('LOU@example.test', { ville: 'Lyon' }));
  assert.ok(!r?.error, r?.error);
  assert.equal(ecritures.length, 1);
});

test('elle ne peut pas basculer la fiche en comédien·ne', async () => {
  const { actions, ecritures } = charger({ id: 'c2', role: 'chef', isOwner: false }, compte);
  const r = await actions.updateFigurantInline('p1', null, formulaire('lou@example.test', { est_comedien: 'on' }));
  assert.match(r.error, /comédien/);
  assert.equal(ecritures.length, 0);
});

test('sans compte candidat, une cheffe non propriétaire peut changer l\'email', async () => {
  const { actions, ecritures } = charger({ id: 'c2', role: 'chef', isOwner: false }, { ...compte, acces_compte: false });
  const r = await actions.updateFigurantInline('p1', null, formulaire('autre@example.test'));
  assert.ok(!r?.error, r?.error);
  assert.equal(ecritures.length, 1);
});
