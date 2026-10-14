import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("candidate session cookies are HttpOnly, SameSite=Lax and Secure over production HTTPS (static guard)", () => {
  const code = read("src/lib/candidats/session.ts");
  const setter = code.split("export async function setFigurantSessionCookie(")[1]?.split("export async function ")[0];
  assert.ok(setter, "candidate session cookie setter missing");
  assert.match(setter, /httpOnly:\s*true/);
  assert.match(setter, /sameSite:\s*["']lax["']/);
  assert.match(setter, /secure:\s*process\.env\.NODE_ENV\s*===\s*["']production["']/);
});

test("local seed uses the protected candidate password table, not figurants.password_hash (static guard)", () => {
  const seed = read("supabase/seed.sql");
  assert.match(seed, /insert into public\.figurant_comptes\s*\(figurant_id, password_hash\)/i);
  assert.doesNotMatch(seed, /pantalon, acces_compte, password_hash/);
  assert.match(seed, /SELECT set_config\('request\.jwt\.claim\.role', 'service_role', true\)/);
  assert.match(seed, /\bCOMMIT;/);
});
