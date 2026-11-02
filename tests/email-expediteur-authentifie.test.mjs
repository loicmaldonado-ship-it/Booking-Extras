// Audit du 31/10/2026 : une réponse par email n'est tenue pour authentique que si Gmail (mx.google.com, premier en-tête)
// a validé DMARC, DKIM ou SPF pour le domaine de l'adresse « De ».
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const load = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), "utf8");
const m = {};
new Function("exports", ts.transpileModule(load("src/lib/email/authentification.ts"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(m);
const ok = m.expediteurAuthentifie;
const gmail = (corps) => `Authentication-Results: mx.google.com;\r\n       ${corps}`;

test("DKIM, SPF ou DMARC valides et alignés : authentique", () => {
  assert.ok(ok([gmail("dkim=pass header.i=@gmail.com header.s=20230601 header.b=abc;\r\n       spf=pass (google.com: domain of a@gmail.com designates 1.2.3.4 as permitted sender) smtp.mailfrom=a@gmail.com;\r\n       dmarc=pass (p=NONE sp=QUARANTINE dis=NONE) header.from=gmail.com")], "a@gmail.com"));
  assert.ok(ok([gmail("dkim=none; spf=pass smtp.mailfrom=bounce@mail.orange.fr; dmarc=none")], "camille@orange.fr"));
  assert.ok(ok([gmail("dkim=pass header.i=@free.fr; spf=softfail smtp.mailfrom=x@relais.example")], "x@free.fr"));
  assert.ok(ok([gmail("dmarc=pass (p=REJECT) header.from=icloud.com")], "Z@ICLOUD.COM"));
});

test("adresse « De » falsifiée : non authentique", () => {
  assert.equal(ok([gmail("dkim=pass header.i=@attaquant.example; spf=pass smtp.mailfrom=x@attaquant.example; dmarc=fail (p=NONE) header.from=gmail.com")], "victime@gmail.com"), false);
  assert.equal(ok([gmail("spf=fail smtp.mailfrom=victime@gmail.com; dkim=none; dmarc=fail header.from=gmail.com")], "victime@gmail.com"), false);
  assert.equal(ok([gmail("dkim=pass header.i=@notgmail.com")], "victime@gmail.com"), false, "suffixe sans point");
});

test("en-tête ajouté par l'expéditeur, sans en-tête Gmail en tête : non authentique", () => {
  assert.equal(ok(["Authentication-Results: autre.example; dmarc=pass header.from=gmail.com"], "victime@gmail.com"), false);
  assert.equal(ok([], "victime@gmail.com"), false);
  // Seul le premier en-tête de Gmail compte ; un faux « pass » plus bas est ignoré.
  assert.equal(ok([gmail("spf=fail smtp.mailfrom=victime@gmail.com; dmarc=fail header.from=gmail.com"), gmail("dmarc=pass header.from=gmail.com")], "victime@gmail.com"), false);
  assert.equal(ok(["Authentication-Results: mx.google.com.attaquant.example; dmarc=pass header.from=gmail.com"], "victime@gmail.com"), false);
});

test("commentaire contenant « pass » ou adresse invalide : non authentique", () => {
  assert.equal(ok([gmail("spf=fail (dmarc=pass header.from=gmail.com) smtp.mailfrom=victime@gmail.com")], "victime@gmail.com"), false);
  assert.equal(ok([gmail("dmarc=pass header.from=gmail.com")], "pas-une-adresse"), false);
});

test("la relève marque les réponses non authentifiées et l'indice oui/non est retiré", () => {
  const releve = load("src/lib/email/releve.ts");
  assert.match(releve, /if \(!expediteurAuthentifie\(authResults, de!\)\) corps = `\$\{AVERTISSEMENT_EXPEDITEUR\}/);
  assert.match(load("src/lib/email/inbox.ts"), /if \(text\.startsWith\(AVERTISSEMENT_EXPEDITEUR\)\) return null;/);
});
