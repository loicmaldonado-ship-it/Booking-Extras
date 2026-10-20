import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
const view = readFileSync(new URL("../src/components/candidatures/postuler-form.tsx", import.meta.url), "utf8");
const action = readFileSync(new URL("../src/lib/candidatures/actions.ts", import.meta.url), "utf8");

test("CAN-04: success screen appears only after server-confirmed candidature", () => {
  assert.match(view, /if \(state\?\.success\) \{/);
  assert.match(view, /Ta candidature a bien été enregistrée/);
  const section = action.slice(action.indexOf("export async function postulerAnnonce("), action.indexOf("async function enregistrerPhotosCandidature("));
  assert.match(section, /if \(candidatureError \|\| !candidature\)/);
  assert.match(section, /if \(photosResultat\.error\)/);
  assert.ok(section.lastIndexOf("return { success: true, compteCree }") > section.indexOf("if (photosResultat.error)"));
});

test("CAN-04: synchronous guard prevents double submit before pending is rendered", () => {
  assert.match(view, /if \(pending \|\| soumissionEnCours\.current\) return;/);
  assert.match(view, /soumissionEnCours\.current = true;\s*startTransition/);
  assert.match(view, /if \(!pending && state !== undefined\) soumissionEnCours\.current = false/);
});
