import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync("src/app/casting/roles/[roleId]/pdf/route.ts", "utf8");
const form = readFileSync("src/components/casting/casting-role-form.tsx", "utf8");

test("role PDF route checks session and project access before downloading private document (static guard)", () => {
  assert.match(route, /await getCurrentProfile\(\)/);
  assert.match(route, /await checkProjetAccess\(role\.projet_id\)/);
  assert.match(route, /\.from\("casting-role-documents"\)/);
  assert.match(route, /\.download\(role\.pdf_storage_path\)/);
  assert.ok(route.indexOf("await checkProjetAccess(role.projet_id)") < route.indexOf(".download(role.pdf_storage_path)"));
  assert.match(route, /no-store/);
  assert.match(route, /Content-Disposition/);
  assert.doesNotMatch(route, /getPublicUrl\(/);
});

test("role calibration has an authenticated document preview link distinct from delete (static guard)", () => {
  assert.match(form, /href=\{`\/casting\/roles\/\$\{role\.id\}\/pdf`\}/);
  assert.match(form, /Ouvrir le PDF/);
  assert.match(form, /name="remove_pdf"/);
});
