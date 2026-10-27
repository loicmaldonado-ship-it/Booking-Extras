import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
test("sensitive candidate login-email methods are server-only helpers, not public Server Actions", () => {
  const action = source("src/lib/candidats/actions.ts");
  const email = source("src/lib/candidats/email.ts");
  assert.match(action, /^"use server"/);
  assert.doesNotMatch(action, /export async function (sendMagicLinkEmail|sendAccesCompteActiveEmail)\(/);
  assert.match(email, /^import "server-only"/);
  assert.doesNotMatch(email, /^"use server"/);
});
test("full candidate edit action checks the signed-in staff member", () => {
  const action = source("src/lib/figurants/edit.ts");
  assert.match(action, /const profile = await getCurrentProfile\(\)/);
  assert.match(action, /comedien_pool_id/);
});
test("schema denies role changes by ordinary authenticated users", () => {
  const migration = source("supabase/migrations/20261011000001_profiles_protected_columns.sql");
  assert.match(migration, /new\.role is distinct from old\.role/);
  assert.match(migration, /new\.is_owner is distinct from old\.is_owner/);
});
