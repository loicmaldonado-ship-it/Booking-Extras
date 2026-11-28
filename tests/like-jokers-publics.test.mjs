// Audit du 31/10/2026 : dans les parcours publics ou candidats, une saisie comparée avec .ilike() doit être échappée
// (« % » et « _ » sont des jokers LIKE) : sinon « % » en nom + le téléphone d'une autre personne renvoyait son adresse
// masquée, et un email à jokers servait à énumérer les comptes ou à rejoindre la fiche comédien·ne d'un·e autre.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const load = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const motif = {};
new Function("exports", ts.transpileModule(load("src/lib/texte/motif.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(motif);

test("echapperMotif neutralise les jokers LIKE et l'échappement", () => {
  assert.equal(motif.echapperMotif("%"), "\\%");
  assert.equal(motif.echapperMotif("a_b%c\\d"), "a\\_b\\%c\\\\d");
  assert.equal(motif.echapperMotif("Dupont"), "Dupont");
});

const PUBLICS = [
  "src/lib/candidatures/actions.ts", // postulerAnnonce (public)
  "src/lib/candidats/inscription.ts", // inscription publique
  "src/lib/candidats/actions.ts", // lien magique, connexion
  "src/lib/figurants/comedien-twin.ts", // rejoindre un casting connecté·e (email du compte candidat)
  "src/lib/casting/rejoindre-actions.ts", // casting sans compte
  "src/app/casting/rejoindre/[token]/page.tsx",
];
for (const fichier of PUBLICS) {
  test(`${fichier} : chaque comparaison .ilike(email|nom) est échappée`, () => {
    const appels = [...load(fichier).matchAll(/\.ilike\(\s*"([\w.]+)",\s*([^)]*\)?)\)/g)].filter(([, col]) => /(^|\.)(email|nom)$/.test(col));
    assert.ok(appels.length > 0, "aucune comparaison trouvée : vérifier le motif du test");
    for (const [appel, , valeur] of appels) {
      // Exception : la recherche d'onglet staff (candidatures/actions.ts) compare un nom d'onglet, pas une saisie publique.
      if (/trimmed/.test(valeur)) continue;
      assert.match(valeur, /echapperMotif\(|replace\(\/\[\\\\%_\]\/g/, `non échappé : ${appel}`);
    }
  });
}
