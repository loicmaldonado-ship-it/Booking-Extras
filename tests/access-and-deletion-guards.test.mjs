import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('each admin getter exposing share tokens checks project membership first (static guard)', () => {
  const code = src('src/lib/partage/actions.ts');
  for (const fn of ['getPartageToken', 'getPartageTitre', 'getJourneePartageLien']) {
    const body = code.split(`export async function ${fn}(`)[1]?.split('export async function ')[0];
    assert.ok(body, `missing ${fn}`);
    assert.match(body, /await requireAccessOrThrow\(projetId\)/);
  }
});

test('casting présentiel migration drops unscoped access and checks project and day (static guard)', () => {
  const code = src('supabase/migrations/20261011000003_casting_presentiel_rls.sql');
  assert.match(code, /drop policy if exists "authenticated full access" on public\.casting_presentiel_creneaux/);
  assert.match(code, /drop policy if exists "authenticated full access" on public\.casting_presentiel_entries/);
  assert.match(code, /public\.has_projet_access\(j\.projet_id\)/);
  assert.match(code, /public\.has_projet_access\(projet_id\)/);
  assert.match(code, /j\.projet_id = casting_presentiel_entries\.projet_id/);
  assert.match(code, /c\.journee_id = casting_presentiel_entries\.journee_id/);
});

test('global figurant deletion requires owner rights, explicit confirmation and atomic database protection', () => {
  const code = src('src/lib/figurants/actions.ts');
  const migration = src('supabase/migrations/20261011000005_delete_unused_figurant.sql');
  assert.match(code, /if \(!actor\?\.isOwner\) return/);
  assert.match(code, /formData\.get\("confirmation"\) !== "SUPPRIMER"/);
  assert.match(code, /supabase\.rpc\("delete_unused_figurant"/);
  assert.match(migration, /auth\.uid\(\) is null or not public\.is_owner\(\)/);
  assert.match(migration, /from public\.figurants where id = p_id for update/);
  assert.match(migration, /from pg_catalog\.pg_constraint c/);
  assert.match(migration, /if linked then/);
  assert.match(migration, /delete from public\.figurants where id = p_id/);
});

test('profile merge is a single atomic RPC with authenticated actor and FK-safe rollback', () => {
  const code = src('src/lib/figurants/actions.ts');
  const migration = src('supabase/migrations/20261011000004_merge_figurants_atomique.sql');
  assert.match(code, /if \(!actor\?\.isOwner\) return/);
  assert.match(code, /supabase\.rpc\("merge_figurants_atomique"/);
  assert.match(migration, /auth\.uid\(\) is null or not public\.is_owner\(\)/);
  assert.match(migration, /from pg_catalog\.pg_constraint c/);
  assert.match(migration, /execute format\('update %I\.%I set %I/);
  assert.match(migration, /delete from public\.figurants where id = p_merge_id/);
});
