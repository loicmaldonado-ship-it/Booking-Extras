import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const code = readFileSync(new URL("../src/lib/casting/upload-actions.ts", import.meta.url), "utf8");
const log = code.split("export async function logCastingUploadEvent(")[1]?.split("export async function createCastingUploadSlot(")[0];

test("casting upload event logging checks staff project membership before service-role insert", () => {
  assert.ok(log, "logging Server Action exists");
  assert.match(code, /import \{ checkProjetAccess \} from "@\/lib\/auth\/session"/);
  assert.match(log, /if \(input\.source === "equipe"\)/);
  assert.match(log, /await checkProjetAccess\(entry\.projet_id\)/);
  assert.ok(log.indexOf("await checkProjetAccess(entry.projet_id)") < log.indexOf('.from("casting_upload_events").insert('));
});

test("candidate event logs require a valid token, not a client-provided entry ID", () => {
  assert.ok(log);
  assert.match(log, /typeof input\.requestToken !== "string" \|\| input\.entryId/);
  assert.match(log, /await loadEntry\(input\.requestToken\)/);
  assert.match(log, /typeof input\.entryId !== "string" \|\| input\.requestToken/);
});

test("upload event logging validates categories and limits arbitrary input sizes", () => {
  assert.ok(log);
  assert.match(log, /\["reussi", "repli_original", "erreur", "annule"\]\.includes\(input\.outcome\)/);
  assert.match(log, /input\.errorMessage\.slice\(0, 500\)/);
  assert.match(log, /input\.userAgent\.slice\(0, 300\)/);
  assert.match(log, /Number\.isSafeInteger\(value\)/);
});
