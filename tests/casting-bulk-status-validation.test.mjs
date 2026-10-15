import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { MAX_CASTING_BULK_UPDATE, validateCastingBulkStatusRequest } from "../src/lib/casting/bulk-status.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const allowed = ["envoyé", "confirmé"];
const check = (ids, statut = "envoyé") => validateCastingBulkStatusRequest(ids, statut, allowed);

test("refuse les sélections absentes, malformées ou trop grandes", () => {
  for (const value of [undefined, "not-array", [], [null], ["bad-uuid"], Array(MAX_CASTING_BULK_UPDATE + 1).fill(A)]) {
    assert.equal(check(value).ok, false);
  }
});

test("refuse les statuts forgés par l'appelant et les identifiants répétés", () => {
  assert.equal(check([A], "forged").ok, false);
  assert.equal(check([A], null).ok, false);
  assert.equal(check([A, A.toUpperCase()]).ok, false);
});

test("accepte plusieurs entrées distinctes et normalise leurs UUID", () => {
  assert.deepEqual(check([A.toUpperCase(), B]), { ok: true, ids: [A, B] });
});

test("la mutation vérifie la lecture complète et les droits AVANT l'écriture service_role", () => {
  const code = readFileSync(new URL("../src/lib/casting/actions.ts", import.meta.url), "utf8");
  const start = code.indexOf("export async function updateCastingEntriesStatutBulk(");
  const end = code.indexOf("export async function updateCastingEntryStatut(", start);
  const bulk = code.slice(start, end);
  assert.ok(bulk.includes("error: readError"));
  assert.ok(bulk.includes("if (readError || !entries || entries.length !== validated.ids.length)"));
  assert.ok(bulk.indexOf("checkProjetAccess(projetId)") < bulk.indexOf('.update({ statut })'));
  assert.ok(bulk.includes('.select("id")'));
  assert.ok(bulk.includes("return { ok: updated.length }"));
});
