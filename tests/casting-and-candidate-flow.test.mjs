import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("creating a role keeps the PDF outside of the create Server Action", () => {
  const page = read("src/components/casting/casting-role-form.tsx");
  const actions = read("src/lib/casting/actions.ts");
  const createBlock = actions.split("export async function createCastingRole(")[1].split("export async function updateCastingRoleCalibration(")[0];
  assert.match(page, /data\.delete\("pdf"\)/);
  assert.match(page, /fetch\(`\/casting\/roles\/\$\{roleId\}\/pdf`/);
  assert.doesNotMatch(createBlock, /uploadRolePdfIfProvided/);
  assert.match(createBlock, /roleId: inserted\.id/);
});

test("PDF upload requires project access and validates actual PDF content", () => {
  const route = read("src/app/casting/roles/[roleId]/pdf/route.ts");
  assert.match(route, /export async function POST/);
  assert.match(route, /getCurrentProfile/);
  assert.match(route, /checkProjetAccess\(role\.projet_id\)/);
  assert.match(route, /validatePdfUpload\(pdf\)/);
  assert.match(route, /from\("casting-role-documents"\)/);
  assert.match(route, /remove\(\[path\]\)/);
});

test("the Casting page guides new users and hides irrelevant empty-state controls", () => {
  const casting = read("src/app/casting/page.tsx");
  assert.match(casting, /Aucun casting dans/);
  assert.match(casting, /<NewCastingRoleCard projetId=\{currentProjetId\} categorie=\{categorie\}/);
  assert.match(casting, /roles\.length > 0 && \[liensCategorie, lienTout\]\.map/);
  assert.match(read("src/components/casting/new-casting-role-card.tsx"), /Créer un rôle/);
});

test("candidate history belongs to the signed-in candidate and hides staff tri", () => {
  const compte = read("src/app/compte/page.tsx");
  assert.match(compte, /getCurrentFigurant\(\)/);
  assert.match(compte, /eq\("figurant_id", session\.id\)/);
  assert.match(compte, /Mes candidatures/);
  assert.match(compte, /projetNomPublic\(annonce\.projets/);
  assert.match(compte, /Candidature reçue/);
  assert.doesNotMatch(compte, /c\.statut/);
});
