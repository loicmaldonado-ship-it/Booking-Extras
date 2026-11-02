// SEC-08 — limite de débit des parcours publics (audit du 31/10/2026, point 2), dans l'application :
// 8 demandes par heure pour une même adresse email, la neuvième est refusée sans rien créer.
// Base et application locales uniquement, données fictives supprimées. Usage : node tests/sec08-limite-inscriptions.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const BASE = process.env.BASE || "http://localhost:3000";
const DB = process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS";
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || "playwright");
const chromium = (await import("./lib/navigateur.mjs")).navigateur(pw, process.env.BROWSER || "chromium");
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.equal(env.BOOKING_TEST_MODE, "1"); assert.match(env.NEXT_PUBLIC_SUPABASE_URL, /^http:\/\/(127\.0\.0\.1|localhost)/);
const psql = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: `set request.jwt.claim.role='service_role';\n${q}`, encoding: "utf8" }).trim().split("\n").filter(Boolean).pop();
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const [id] = Object.entries(manifest).find(([, v]) => v.filename === "src/lib/casting/rejoindre-actions.ts" && v.exportedName === "postulerCastingSansCompte");
const T = "SEC08-" + Date.now();
const P = psql(`insert into projets(nom, owner_id) values('${T}','00000000-0000-4000-8000-00000000c0c0') returning id;`);
const tok = psql(`insert into casting_roles(projet_id,nom,lien_public_actif) values('${P}','${T} rôle',true) returning public_token;`);
psql("delete from limites_publiques;");
const b = await chromium.launch();
let ok = true;
try {
  const page = await b.newPage();
  await page.goto(`${BASE}/casting/rejoindre/${tok}`);
  const envoyer = (i) => page.evaluate(async ({ url, id, tok, i, T }) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ prenom: "Essai", nom: `${T}${i}`, email: `${T.toLowerCase()}@example.test`, telephone: "0611223344" })) fd.append(`_1_${k}`, v);
    fd.append("0", JSON.stringify([tok, null, "$K1"]));
    const r = await fetch(url, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component" }, body: fd, redirect: "manual" });
    return r.text();
  }, { url: `${BASE}/casting/rejoindre/${tok}`, id, tok, i, T });
  for (let i = 1; i <= 8; i++) {
    const t = await envoyer(i);
    if (/Trop de demandes/.test(t)) { console.log(`KO  demande ${i} refusée trop tôt`); ok = false; }
  }
  const avant = psql(`select count(*) from figurants where email='${T.toLowerCase()}@example.test';`);
  const neuvieme = await envoyer(9);
  const apres = psql(`select count(*) from figurants where email='${T.toLowerCase()}@example.test';`);
  const refus = /Trop de demandes/.test(neuvieme) && avant === apres;
  console.log(`${refus ? "OK " : "KO "} 9e demande pour la même adresse refusée, rien créé`); ok &&= refus;
} finally {
  await b.close();
  psql(`delete from projets where id='${P}'; delete from figurants where nom like '${T}%' or email like '${T.toLowerCase()}%'; delete from limites_publiques;`);
}
process.exit(ok ? 0 : 1);
