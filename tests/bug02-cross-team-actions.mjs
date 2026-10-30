// BUG-02 : appels DIRECTS des actions serveur sensibles par une cheffe d'une AUTRE équipe.
// Base LOCALE et application locale uniquement (BOOKING_TEST_MODE=1), données fictives.
// Pré-requis : `npm run build && npm start` (port 3000) + Supabase local avec le seed.
// Usage : node tests/bug02-cross-team-actions.mjs
// Le script crée une cheffe B et des ressources fictives dans le projet A du seed, appelle chaque
// action avec les identifiants de A en étant connecté en B, puis vérifie en base que rien n'a bougé.
// Les ressources fictives créées sont supprimées à la fin.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const DB = process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.equal(env.BOOKING_TEST_MODE, "1", "BOOKING_TEST_MODE=1 requis");
assert.match(env.NEXT_PUBLIC_SUPABASE_URL, /127\.0\.0\.1|localhost/, "Base locale uniquement");

const sql = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", q], { encoding: "utf8" }).trim();
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const actionId = (file, name) => {
  const hit = Object.entries(manifest).find(([, v]) => v.filename === file && v.exportedName === name);
  assert.ok(hit, `Action introuvable dans le build : ${file}#${name}`);
  const page = Object.keys(hit[1].workers).find((w) => w.endsWith("/page")).replace(/^app/, "").replace(/\/page$/, "") || "/";
  return { id: hit[0], page: page.replace(/\[[^\]]+\]/g, "00000000-0000-4000-8000-000000000000") };
};

const PA = "00000000-0000-4000-8000-0000000070e0"; // projet A du seed
const FIG = "00000000-0000-4000-8000-00000000f001";
const ANN = "00000000-0000-4000-8000-00000000a000";
const TAG = "BUG02-" + Date.now();
const B_EMAIL = `cheffe-b-${Date.now()}@example.test`;
const B_PASS = "booking-test-b";

// --- Cheffe B (non propriétaire globale) avec son propre projet ---
const created = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email: B_EMAIL, password: B_PASS, email_confirm: true }),
}).then((r) => r.json());
assert.ok(created.id, "Création cheffe B impossible : " + JSON.stringify(created));
const B = created.id;
const svc = (q) => sql(`set request.jwt.claim.role='service_role'; ${q}`);
svc(`update public.profiles set role='chef', is_owner=false, nom='Cheffe B fictive' where id='${B}'`);
const PB = sql(`insert into public.projets(nom, owner_id) values('${TAG} projet B','${B}') returning id`).split("\n")[0];

// --- Ressources fictives dans le projet A ---
const one = (q) => sql(q).split("\n")[0];
const fx = {};
fx.journee = one(`insert into public.journees(projet_id,date) values('${PA}', current_date+60) returning id`);
fx.besoin = one(`insert into public.journee_besoins(journee_id,fonction,quantite) values('${fx.journee}','${TAG}',2) returning id`);
fx.booking = one(`insert into public.bookings(figurant_id,projet_id,date,notes) values('${FIG}','${PA}',current_date+60,'${TAG}') returning id`);
fx.role = one(`insert into public.casting_roles(projet_id,nom) values('${PA}','${TAG}') returning id`);
fx.entry = one(`insert into public.casting_entries(projet_id,figurant_id,role_id,notes) values('${PA}','${FIG}','${fx.role}','${TAG}') returning id`);
fx.essJournee = one(`insert into public.essayage_journees(projet_id,date) values('${PA}', current_date+61) returning id`);
fx.essayage = one(`insert into public.essayages(figurant_id,projet_id,essayage_journee_id) values('${FIG}','${PA}','${fx.essJournee}') returning id`);
fx.question = one(`insert into public.annonce_questions(annonce_id,label) values('${ANN}','${TAG}') returning id`);
fx.annonce = one(`insert into public.annonces(projet_id,titre,statut) values('${PA}','${TAG}','ouverte') returning id`);
fx.reserve = one(`insert into public.reserve_profils(projet_id,figurant_id) values('${PA}','${FIG}') returning id`);
fx.partage = one(`insert into public.partage_liens(projet_id,type,token) values('${PA}','documents','${TAG}-token') returning id`);
fx.membre = "a3cb1c71-f9e9-4e71-97d3-eb2df20128b6"; // assistante du seed dans le projet A
fx.membre = one(`select id from public.projet_membres where projet_id='${PA}' limit 1`) || fx.membre;

const snapshot = () => ({
  journee: sql(`select count(*) from journees where id='${fx.journee}'`),
  besoin: sql(`select fonction||quantite from journee_besoins where id='${fx.besoin}'`),
  booking: sql(`select coalesce(statut,'')||'|'||coalesce(notes,'')||'|'||date from bookings where id='${fx.booking}'`),
  role: sql(`select count(*) from casting_roles where id='${fx.role}'`),
  entry: sql(`select coalesce(notes,'') from casting_entries where id='${fx.entry}'`),
  essayage: sql(`select count(*) from essayages where id='${fx.essayage}'`),
  question: sql(`select count(*) from annonce_questions where id='${fx.question}'`),
  annonce: sql(`select statut from annonces where id='${fx.annonce}'`),
  reserve: sql(`select count(*) from reserve_profils where id='${fx.reserve}'`),
  partage: sql(`select count(*) from partage_liens where id='${fx.partage}'`),
  membre: sql(`select count(*) from projet_membres where id='${fx.membre}'`),
});

const calls = [
  ["src/lib/bookings/actions.ts", "deleteBooking", [fx.booking]],
  ["src/lib/bookings/actions.ts", "retirerBookings", [[fx.booking]]],
  ["src/lib/bookings/actions.ts", "deleteJournee", [fx.journee]],
  ["src/lib/bookings/besoins-actions.ts", "deleteBesoin", [fx.besoin]],
  ["src/lib/casting/actions.ts", "updateCastingEntryNotes", [fx.entry, "INTRUSION"]],
  ["src/lib/casting/actions.ts", "deleteCastingEntry", [fx.entry]],
  ["src/lib/casting/actions.ts", "deleteCastingRole", [fx.role]],
  ["src/lib/essayages/actions.ts", "deleteEssayage", [fx.essayage]],
  ["src/lib/annonces/actions.ts", "toggleAnnonceStatut", [fx.annonce, "fermée"]],
  ["src/lib/annonces/actions.ts", "deleteAnnonce", [fx.annonce]],
  ["src/lib/annonces/questions.ts", "removeAnnonceQuestion", [fx.question, ANN]],
  ["src/lib/reserve/actions.ts", "retirerDeLaReserve", [[fx.reserve]]],
  ["src/lib/partage/actions.ts", "getPartageToken", [PA, "documents", null]],
  ["src/lib/partage/actions.ts", "revokePartageLien", [PA, "documents", null]],
  ["src/lib/equipe/actions.ts", "revokeAccess", [fx.membre]],
];

const browser = await chromium.launch();
const results = [];
let before;
try {
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/login");
  await page.fill("input[type=email]", B_EMAIL);
  await page.fill("input[type=password]", B_PASS);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }), page.locator("form button[type=submit]").first().click()]);
  before = snapshot();
  for (const [file, name, args] of calls) {
    const { id, page: worker } = actionId(file, name);
    const r = await page.evaluate(async ({ url, id, body }) => {
      const res = await fetch(url, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body });
      return { status: res.status, text: (await res.text()).slice(-300) };
    }, { url: BASE + worker, id, body: JSON.stringify(args) });
    const leakedToken = r.text.includes(`${TAG}-token`);
    results.push({ action: name, status: r.status, leakedToken, reponse: r.text.replace(/\s+/g, " ").slice(-160) });
  }
} finally {
  await browser.close();
}
const after = snapshot();

const changed = Object.keys(before).filter((k) => before[k] !== after[k]);
console.table(results.map((r) => ({ action: r.action, http: r.status, token_divulgue: r.leakedToken, reponse: r.reponse })));
console.log("Avant :", before);
console.log("Après :", after);

// --- Nettoyage des données fictives ---
svc(`delete from public.casting_entries where id='${fx.entry}'; delete from public.casting_roles where id='${fx.role}';
 delete from public.essayages where id='${fx.essayage}'; delete from public.essayage_journees where id='${fx.essJournee}';
 delete from public.bookings where id='${fx.booking}'; delete from public.journee_besoins where id='${fx.besoin}'; delete from public.journees where id='${fx.journee}';
 delete from public.annonce_questions where id='${fx.question}'; delete from public.annonces where id='${fx.annonce}';
 delete from public.reserve_profils where id='${fx.reserve}'; delete from public.partage_liens where id='${fx.partage}';
 delete from public.projets where id='${PB}';`);
await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${B}`, { method: "DELETE", headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });

assert.deepEqual(changed, [], "Données de l'équipe A modifiées par la cheffe B : " + changed.join(", "));
assert.ok(!results.some((r) => r.leakedToken), "Token de partage de l'équipe A divulgué à la cheffe B");
console.log(`PASS: ${calls.length} actions appelées directement par une cheffe d'une autre équipe, aucune donnée de l'équipe A modifiée ni divulguée.`);
