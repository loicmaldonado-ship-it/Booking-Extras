// SEC-04 / CAN-02 : aucune donnée privée d'une équipe A ne doit apparaître dans les PAGES vues par une autre équipe.
// Base et application LOCALES uniquement (BOOKING_TEST_MODE=1), données fictives.
// Usage : node tests/sec04-read-leak-pages.mjs   (ACTOR=cheffe-autre-equipe | assistante-hors-projet)
//
// Équipe A (cheffe non propriétaire) : projet, annonce, candidature, booking, casting, essayage, dossier mineur, lien de
// partage, et trois profils PRIVÉS dont le nom porte un marqueur unique :
//   - profil créé par « ajout rapide » SANS compte, rattaché au projet A (doit rester introuvable ailleurs — CAN-02) ;
//   - comédien·ne du vivier privé de A ;
//   - mineur avec dossier.
// L'acteur B visite toutes les pages staff de l'application, avec les identifiants de A dans l'URL, les paramètres
// projet_id/date/q, et le cookie de projet courant forcé sur le projet A. Le marqueur ne doit apparaître nulle part.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const DB = process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS";
const ACTOR = process.env.ACTOR || "cheffe-autre-equipe";
const require = createRequire(import.meta.url);
const NAV = process.env.BROWSER || "chromium"; // chromium | webkit (moteur de Safari) | firefox
const pw = require(process.env.PLAYWRIGHT_PATH || "playwright");
const chromium = (await import("./lib/navigateur.mjs")).navigateur(pw, NAV);
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.equal(env.BOOKING_TEST_MODE, "1");
assert.match(env.NEXT_PUBLIC_SUPABASE_URL, /127\.0\.0\.1|localhost/);
const psql = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }).trim();
const svc = (q) => psql(`set request.jwt.claim.role='service_role';\n${q}`);
const one = (q) => svc(q).split("\n").filter(Boolean).pop();
const admin = (path, method = "GET", body) => fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/${path}`, { method, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());

const MARK = "Zqxprive" + Date.now().toString(36);
const D = one("select (current_date+75)::text;");
const user = async (role, label) => {
  const email = `${label}-${Date.now()}@example.test`;
  const u = await admin("users", "POST", { email, password: "booking-test-x", email_confirm: true });
  assert.ok(u.id, JSON.stringify(u));
  svc(`update profiles set role='${role}', is_owner=false, nom='${label}' where id='${u.id}';`);
  return { id: u.id, email };
};

// ---- Équipe A ----
const chefA = await user("chef", "cheffe-a");
const A = {};
A.P = one(`insert into projets(nom,owner_id) values('Projet A ${MARK}','${chefA.id}') returning id;`);
A.ann = one(`insert into annonces(projet_id,titre,statut) values('${A.P}','Annonce ${MARK}','ouverte') returning id;`);
A.annDate = one(`insert into annonce_dates(annonce_id,date) values('${A.ann}','${D}') returning id;`);
A.figSansCompte = one(`insert into figurants(prenom,nom,date_naissance,telephone,temporaire_projet_id,acces_compte) values('Rapide','${MARK}Rapide','1990-01-01','0600000001','${A.P}',false) returning id;`);
A.comedien = one(`insert into figurants(prenom,nom,date_naissance,est_comedien,comedien_pool_id,acces_compte) values('Comedien','${MARK}Comedien','1985-01-01',true,'${chefA.id}',true) returning id;`);
svc(`insert into figurant_comptes(figurant_id,password_hash) values('${A.comedien}','fixture');`);
A.cand = one(`insert into candidatures(figurant_id,annonce_id) values('${A.comedien}','${A.ann}') returning id;`);
A.journee = one(`insert into journees(projet_id,date) values('${A.P}','${D}') returning id;`);
A.bkRapide = one(`insert into bookings(figurant_id,projet_id,date,statut,notes) values('${A.figSansCompte}','${A.P}','${D}','confirmé','Note ${MARK}') returning id;`);
A.bkComedien = one(`insert into bookings(figurant_id,projet_id,date,statut) values('${A.comedien}','${A.P}','${D}','confirmé') returning id;`);
A.role = one(`insert into casting_roles(projet_id,nom) values('${A.P}','Role ${MARK}') returning id;`);
A.entry = one(`insert into casting_entries(projet_id,figurant_id,role_id) values('${A.P}','${A.comedien}','${A.role}') returning id;`);
A.eJ = one(`insert into essayage_journees(projet_id,date) values('${A.P}','${D}') returning id;`);
A.essayage = one(`insert into essayages(figurant_id,projet_id,essayage_journee_id) values('${A.figSansCompte}','${A.P}','${A.eJ}') returning id;`);
A.dossier = one(`insert into minor_dossiers(projet_id,figurant_id) values('${A.P}','${A.figSansCompte}') returning id;`);

// ---- Acteur B ----
const B = ACTOR === "cheffe-autre-equipe" ? await user("chef", "cheffe-b") : await user("assistant", "assistante-b");
if (ACTOR === "cheffe-autre-equipe") svc(`insert into projets(nom,owner_id) values('Projet B','${B.id}');`);
else svc(`update profiles set acces_complet=true, sections_autorisees=null where id='${B.id}';`);

const pages = JSON.parse(readFileSync(".next/server/app-paths-manifest.json", "utf8"));
const ID = { "annonces/[id]": A.ann, "bookings/[id]": A.bkRapide, "candidatures/[id]": A.ann, "essayages/[id]": A.essayage, "figurants/[id]": A.figSansCompte, "projets/[id]": A.P, "[dossierId]": A.dossier };
const urls = new Set();
for (const k of Object.keys(pages).filter((k) => k.endsWith("/page"))) {
  let r = k.replace(/\/page$/, "") || "/";
  if (/_global-error|_not-found|\[token\]|^\/(login|compte|auth|offline|confidentialite|postuler|recu|disponibilites)/.test(r)) continue;
  for (const [seg, v] of Object.entries(ID)) r = r.replace(seg.includes("/") ? seg : seg, seg.includes("/") ? seg.replace("[id]", v) : v);
  if (r.includes("[")) continue;
  urls.add(r);
  urls.add(`${r}?projet_id=${A.P}&date=${D}&q=${MARK.slice(0, -3)}`); // préfixe : trouve les noms, sans écho du marqueur complet
}
for (const f of [A.comedien]) { urls.add(`/figurants/${f}`); urls.add(`/figurants/${f}/fiche`); }
urls.add(`/bookings/documents?projet_id=${A.P}&date=${D}&onglet=all`);

const browser = await chromium.launch();
const leaks = [];
try {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("input[type=email]", B.email); await page.fill("input[type=password]", "booking-test-x");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }), page.locator("form button[type=submit]").first().click()]);
  await ctx.addCookies([{ name: "current_projet_id", value: A.P, url: BASE }]); // cookie de projet courant forgé
  for (const u of urls) {
    const res = await page.request.get(BASE + u, { maxRedirects: 5 }).catch((e) => ({ status: () => "ERR", text: async () => String(e) }));
    const body = await res.text();
    if (body.includes(MARK)) leaks.push(`${u} [${res.status()}] ${body.slice(Math.max(0, body.indexOf(MARK) - 80), body.indexOf(MARK) + 40).replace(/\s+/g, " ")}`);
  }
  // Contrôle inverse : la cheffe A voit toujours ses propres profils privés dans les listes de choix.
  const ctxA = await browser.newContext(); const pa = await ctxA.newPage();
  await pa.goto(BASE + "/login"); await pa.fill("input[type=email]", chefA.email); await pa.fill("input[type=password]", "booking-test-x");
  await Promise.all([pa.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }), pa.locator("form button[type=submit]").first().click()]);
  for (const u of ["/bookings/nouveau", "/essayages/nouveau"]) {
    const body = await (await pa.request.get(BASE + u)).text();
    if (!body.includes(MARK + "Rapide") || !body.includes(MARK + "Comedien")) leaks.push(`ACCÈS LÉGITIME PERDU : la cheffe A ne voit plus ses profils dans ${u}`);
  }
} finally {
  await browser.close();
  svc(`delete from projets where nom like '%${MARK}%' or owner_id='${B.id}'; delete from figurants where nom like '${MARK}%';`);
  for (const u of [chefA, B]) await admin(`users/${u.id}`, "DELETE");
}
console.log(`[${ACTOR}] ${urls.size} pages visitées avec les identifiants de l'équipe A.`);
for (const l of leaks) console.log(" FUITE:", l);
assert.deepEqual(leaks, [], "Données privées de l'équipe A visibles par " + ACTOR);
console.log(`PASS [${ACTOR}]: aucune donnée privée de l'équipe A (profil sans compte, comédien privé, mineur, booking, casting) dans les pages.`);
