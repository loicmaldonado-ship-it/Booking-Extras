import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeTelephoneForDuplicate } from "../src/lib/figurants/duplicate-normalization.ts";
import { readFileSync } from "node:fs";

test("les formats français équivalents signalent le même téléphone", () => {
  const vals = ["06 12 34 56 78", "+33 6 12 34 56 78", "0033(0)6-12-34-56-78", "+33 (0)6 12 34 56 78"];
  assert.deepEqual(vals.map(normalizeTelephoneForDuplicate), Array(vals.length).fill("0612345678"));
});

test("les numéros internationaux ne sont pas confondus avec les français", () => {
  assert.equal(normalizeTelephoneForDuplicate("+44 20 7123 4567"), "+442071234567");
  assert.equal(normalizeTelephoneForDuplicate("0044 20 7123 4567"), "+442071234567");
  assert.notEqual(normalizeTelephoneForDuplicate("+44 20 7123 4567"), normalizeTelephoneForDuplicate("02 07 12 34 56"));
});

test("les numéros incomplets ou factices ne déclenchent pas d'alertes", () => {
  for (const raw of [null, "", "123", "06-12-xxx", "0000000000", "1111111111", "+12"]) {
    assert.equal(normalizeTelephoneForDuplicate(raw), null);
  }
});

test("le rapprochement des profils reste une suggestion humaine", () => {
  const code = readFileSync(new URL("../src/lib/figurants/duplicates.ts", import.meta.url), "utf8");
  assert.match(code, /normalizeTelephoneForDuplicate\(figurant\.telephone\)/);
  assert.match(code, /normalizeTelephoneForDuplicate\(c\.telephone\)/);
  assert.match(code, /export async function findPossibleDuplicates/);
  assert.doesNotMatch(code, /\.update\(|\.delete\(|\.insert\(/);
});
