import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("figurant preview refuses anonymous calls before service-role reads", () => {
  const code = source("src/lib/figurants/preview.ts");
  const body = code.split("export async function getFigurantPreview(")[1];
  assert.ok(body);
  assert.match(body, /const profile = await getCurrentProfile\(\)/);
  assert.match(body, /if \(!profile\) return \{ error: "Non autorisé\." \}/);
  assert.ok(body.indexOf("if (!profile)") < body.indexOf("const supabase = createAdminClient()"));
  assert.match(body, /comedien_pool_id !== comedienPoolIdFor\(profile\)/);
});

test("privileged messaging actions check staff and project access", () => {
  const code = source("src/lib/figurants/messages-actions.ts");
  assert.match(code, /async function requireStaffMessageAccess\(/);
  assert.match(code, /if \(!actor\) return \{ error: "Non autorisé\." \}/);
  assert.match(code, /checkProjetAccess\(projetId\)/);
  assert.match(code, /comedien_pool_id !== comedienPoolIdFor\(actor\)/);
  for (const name of ["sendStaffMessageToFigurant", "notifyFigurantByEmail", "toggleMessageRepondu"]) {
    const body = code.split(`export async function ${name}(`)[1]?.split("export async function ")[0];
    assert.ok(body, `Missing ${name}`);
    assert.match(body, /requireStaffMessageAccess\(/);
  }
  assert.match(code, /storedEmail = access\.figurant\.email/);
  assert.match(code, /process\.env\.NEXT_PUBLIC_SITE_URL/);
});
