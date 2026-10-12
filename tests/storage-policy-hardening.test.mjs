import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261012000003_securiser_autres_buckets_storage.sql", import.meta.url),
  "utf8"
);

const expectedDrops = {
  "casting videos": ["read", "upload", "delete"],
  "casting role documents": ["read", "upload", "delete"],
  "annonce medias": ["upload", "update", "delete"],
  "document templates": ["upload", "update", "delete"],
  "profile avatars": ["upload", "update", "delete"],
};

test("direct authenticated Storage permissions are dropped for each sensitive bucket", () => {
  for (const [bucket, actions] of Object.entries(expectedDrops)) {
    for (const action of actions) {
      assert.ok(
        migration.includes(`drop policy if exists "authenticated ${action} ${bucket}" on storage.objects;`),
        `Policy still open: ${action} ${bucket}`
      );
    }
  }
});

test("public read policies are preserved and no broad replacement policy is introduced", () => {
  assert.doesNotMatch(migration, /drop policy if exists "public read/i);
  assert.doesNotMatch(migration, /create policy/i);
  assert.doesNotMatch(migration, /update\s+storage\.buckets\s+set\s+public\s*=/i);
});

test("migration runs atomically", () => {
  assert.match(migration, /\bbegin\s*;/i);
  assert.match(migration, /\bcommit\s*;/i);
});
