import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../src/components/candidatures/postuler-form.tsx", import.meta.url), "utf8");
const photo = source.slice(source.indexOf("function PhotoSlot("), source.indexOf("// Nom lisible d'un champ invalide"));
const dialog = source.slice(source.indexOf("function ChoixMesPhotos("), source.indexOf("function PhotoSlot("));

test("chaque photo utilise un vrai bouton accessible au clavier", () => {
  assert.match(photo, /<button\s+type="button"\s+aria-label=\{`Choisir une photo : \$\{label\}`\}/);
  assert.match(photo, /aria-describedby=\{erreur \? errorId : labelId\}/);
  assert.match(photo, /focus-visible:outline-coral/);
  assert.match(photo, /disabled=\{preparation\}/);
});

test("supprimer une photo est possible au clavier avec un nom accessible", () => {
  assert.match(photo, /aria-label=\{`Retirer la photo : \$\{label\}`\}/);
  assert.match(photo, /role="alert"/);
  assert.doesNotMatch(photo, /onClick=\{\(e\) => e\.stopPropagation\(\)\}/);
});

test("la sélection de photos existantes traite Escape, Tab et le retour de focus", () => {
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /event\.key === "Escape"/);
  assert.match(dialog, /event\.key === "Tab"/);
  assert.match(dialog, /previousFocus\?\.focus\(\)/);
});

test("les URL blob des aperçus sont libérées et les erreurs préparation ne bloquent pas le formulaire", () => {
  assert.match(photo, /URL\.revokeObjectURL\(objectUrlRef\.current\)/);
  assert.match(photo, /\}\s*finally \{\s*setPreparation\(false\);/);
  assert.match(photo, /aria-busy=\{preparation\}/);
});

test("la confirmation n'est affichée que pour un succès serveur", () => {
  assert.match(source, /if \(state\?\.success\) \{\s*return \(\s*<Card[^>]*role="status"/);
  assert.match(source, /ref=\{erreurServeurRef\} role="alert"/);
});
