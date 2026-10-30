// CAN-03 : détection des doublons à la création de compte candidate (appli réelle, base locale, données fictives).
// Usage : node tests/can03-doublons-local.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const require = createRequire(import.meta.url);
const NAV = process.env.BROWSER || "chromium"; // chromium | webkit (moteur de Safari) | firefox
const pw = require(process.env.PLAYWRIGHT_PATH || "playwright");
const chromium = (await import("./lib/navigateur.mjs")).navigateur(pw, NAV);
const sharp = require("sharp");
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: `set request.jwt.claim.role='service_role';\n${q}`, encoding: "utf8" }).trim();
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const [ID] = Object.entries(manifest).find(([, v]) => v.filename === "src/lib/candidats/inscription.ts" && v.exportedName === "inscrireCandidat");
const jpeg = (await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#b09080" } }).jpeg().toBuffer()).toString("base64");
const stamp = Date.now();
const form = (over) => ({ prenom: "Test", nom: "Doublon" + stamp, email: `doublon-${stamp}@example.test`, telephone: "0612" + String(stamp).slice(-6), ville: "Paris", adresse: "1 rue Fictive", code_postal: "75001", date_naissance: "1990-01-01", commune_naissance: "Paris", genre: "Femme", pronom: "Elle", message: "Bonjour", taille_cm: "170", poids_kg: "60", pointure: "40", veste: "M", pantalon: "38", selfie_date: new Date().toISOString().slice(0, 10), a_vehicule: "non", sans_agent: "on", password: "motdepasse-fictif-123", password_confirmation: "motdepasse-fictif-123", ...over });
async function inscrire(page, champs) {
  return page.evaluate(async ({ id, champs, jpeg }) => {
    const bin = Uint8Array.from(atob(jpeg), (c) => c.charCodeAt(0));
    const fd = new FormData();
    for (const [k, v] of Object.entries(champs)) fd.append(`_1_${k}`, v);
    for (const p of ["photo_portrait", "photo_pied", "photo_selfie"]) fd.append(`_1_${p}`, new File([bin], `${p}.jpg`, { type: "image/jpeg" }));
    fd.append("0", JSON.stringify([null, "$K1"]));
    const r = await fetch("/compte/inscription", { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component" }, body: fd });
    return ((await r.text()).split("\n").find((l) => l.startsWith("1:")) || "").slice(2, 260);
  }, { id: ID, champs, jpeg });
}
const browser = await chromium.launch();
const out = [];
try {
  const ctx = () => browser.newContext().then((c) => c.newPage()).then(async (p) => { await p.goto(BASE + "/compte/inscription"); return p; });
  const seedEmail = "Candidate.TEST@test-figurant.fr";
  out.push(["Même email (casse différente) qu'un compte existant", await inscrire(await ctx(), form({ email: seedEmail })), /déjà un compte/i]);
  out.push(["Même nom + même téléphone (espaces), autre email", await inscrire(await ctx(), form({ nom: "Candidate-Test", telephone: "06 00 00 00 03", email: `autre-${stamp}@example.test` })), /existe déjà à ton nom.*•/i]);
  const homonyme = await inscrire(await ctx(), form({ nom: "Candidate-Test", telephone: "0699" + String(stamp).slice(-6), email: `homonyme-${stamp}@example.test` }));
  out.push(["Homonyme avec un autre téléphone : accepté", homonyme, /^(?!.*error)/]);
  const [p1, p2] = await Promise.all([ctx(), ctx()]);
  const [r1, r2] = await Promise.all([inscrire(p1, form({ email: `simultane-${stamp}@example.test`, telephone: "0611" + String(stamp).slice(-6) })), inscrire(p2, form({ email: `simultane-${stamp}@example.test`, telephone: "0622" + String(stamp).slice(-6) }))]);
  const comptes = Number(sql(`select count(*) from figurants where lower(email)='simultane-${stamp}@example.test';`));
  out.push(["Deux inscriptions simultanées, même email : un seul profil", `${comptes} profil(s) ; ${r1.slice(0, 60)} | ${r2.slice(0, 60)}`, /^1 profil/]);
} finally {
  await browser.close();
  sql(`delete from figurants where email like '%-${stamp}@example.test';`);
}
const rows = out.map(([cas, reponse, attendu]) => ({ cas, ok: attendu.test(reponse), reponse: reponse.slice(0, 110) }));
console.table(rows);
assert.deepEqual(rows.filter((r) => !r.ok).map((r) => r.cas), [], "Détection des doublons en défaut");
console.log("PASS: doublons détectés (email, nom + téléphone), homonymes acceptés, aucune double création simultanée.");
