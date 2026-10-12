import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261012000002_securiser_lectures_figurants_storage.sql", import.meta.url),
  "utf8"
);

test("figurant photos are readable only through visible profiles and their project", () => {
  assert.match(migration, /create policy "figurant photos scoped read"/);
  assert.match(migration, /f\.id\s*=\s*figurant_photos\.figurant_id/);
  assert.match(migration, /projet_id is null\s+or public\.has_projet_access\(projet_id\)/);
});

test("figurant links are readable only for a visible figurant", () => {
  assert.match(migration, /create policy "figurant liens scoped read"/);
  assert.match(migration, /f\.id\s*=\s*figurant_liens\.figurant_id/);
});

test("old unscoped authenticated Storage policies are removed", () => {
  for (const action of ["read", "upload", "update", "delete"]) {
    assert.ok(
      migration.includes(`drop policy if exists "authenticated ${action} figurant photos" on storage.objects;`),
      `${action} policy not removed`
    );
  }
  assert.doesNotMatch(migration, /create policy\s+.+\s+on storage\.objects/i);
});
