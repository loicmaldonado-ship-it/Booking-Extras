import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cases = [
  ["projets", "Liste des projets", "Aucun projet", "href={\"/projets/\" + p.id}"],
  ["annonces", "Liste des annonces", "Aucune annonce", "href={\"/annonces/\" + a.id}"],
  ["rgpd", "Profils inactifs", "Aucun profil inactif", "AnonymiserButton"],
];

for (const [page, label, empty, linkOrAction] of cases) {
  test(`BUG-17: ${page} has a compact list and a desktop table`, () => {
    const source = readFileSync(`src/app/${page}/page.tsx`, "utf8");
    assert.match(source, /className="grid gap-3 md:hidden"/);
    assert.ok(source.includes(`aria-label="${label}"`));
    assert.match(source, /className="hidden overflow-x-auto p-0 md:block"/);
    assert.match(source, /min-w-\[\d+px\]/);
    assert.ok(source.includes(empty));
    assert.ok(source.includes(linkOrAction));
  });
}

test("BUG-17: both list filters remain usable on small screens", () => {
  for (const page of ["projets", "annonces"]) {
    const source = readFileSync(`src/app/${page}/page.tsx`, "utf8");
    assert.ok(source.includes("grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4"));
    assert.match(source, /className="sm:col-span-2[^"]*md:col-span-1"/);
  }
});
