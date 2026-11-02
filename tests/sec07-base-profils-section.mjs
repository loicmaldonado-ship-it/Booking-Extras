// SEC-07 — Base Profils réservée au personnel qui a la section (audit du 31/10/2026, point 1).
// Une assistante sans « Base Profils » ne lit plus les fiches de la base partagée par l'API, mais garde les noms dans
// ses listes de choix, peut booker ces personnes et lit les fiches complètes des personnes de ses projets.
// Base et application locales uniquement (BOOKING_TEST_MODE=1), données fictives créées puis supprimées.
// Usage : node tests/sec07-base-profils-section.mjs (application lancée sur le port 3000)
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
assert.equal(env.BOOKING_TEST_MODE, "1", "BOOKING_TEST_MODE=1 requis");
assert.match(env.NEXT_PUBLIC_SUPABASE_URL, /^http:\/\/(127\.0\.0\.1|localhost)/, "Base locale uniquement");

const psql = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }).trim();
const svc = (q) => psql(`set request.jwt.claim.role='service_role';\n${q}`);
const one = (q) => svc(q).split("\n").filter(Boolean).pop();
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
function action(file, name) {
  const entry = Object.entries(manifest).find(([, v]) => v.filename === file && v.exportedName === name);
  assert.ok(entry, `Action introuvable : ${file}#${name}`);
  const ws = Object.keys(entry[1].workers).filter((w) => w.endsWith("/page"));
  const worker = ((ws.find((w) => !w.includes("[")) || ws[0]) || "app/page").replace(/^app/, "").replace(/\/page$/, "").replace(/\[[^\]]+\]/g, "x") || "/";
  return { id: entry[0], url: BASE + worker };
}
async function call(page, a, args) {
  return page.evaluate(async ({ url, id, args }) => {
    const res = await fetch(url, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(args) });
    return { status: res.status, text: await res.text() };
  }, { url: a.url, id: a.id, args });
}

const T = "SEC07-" + Date.now();
const SEED_CHEF = "00000000-0000-4000-8000-00000000c0c0";
const results = [];
const check = (nom, ok, detail = "") => { results.push({ nom, ok }); console.log(`${ok ? "OK " : "KO "} ${nom}${detail ? " — " + detail : ""}`); };

const P = one(`insert into projets(nom, owner_id) values('${T} projet','${SEED_CHEF}') returning id;`);
const date = one(`select (current_date+30)::text;`);
const fiche = (prenom, suffixe, dn = "1990-05-05") => one(`insert into figurants(prenom,nom,email,telephone,date_naissance,adresse,code_postal,ville,genre,acces_compte,confirme)
  values('${prenom}','${T}${suffixe}','${T.toLowerCase()}-${suffixe.toLowerCase()}@example.test','0611223344','${dn}','1 rue Fictive','75001','Paris','Femme',true,true) returning id;`);
const X = fiche("Base", "Base");           // dans la base, sans lien avec le projet
const Y = fiche("Projet", "Projet");       // bookée sur le projet
const M = fiche("Mineure", "Mineure", `${new Date().getFullYear() - 10}-03-03`); // mineure de la base
svc(`insert into bookings(figurant_id,projet_id,date,statut) values('${Y}','${P}','${date}','confirmé');`);

const admin = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
async function compte(suffixe, sections) {
  const email = `${T.toLowerCase()}-${suffixe}@example.test`, password = "booking-test-" + suffixe;
  const u = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password, email_confirm: true }) }).then((r) => r.json());
  assert.ok(u.id, "Création du compte impossible");
  svc(`update profiles set role='assistant', is_owner=false, nom='${suffixe} fictive', sections_autorisees=${sections} where id='${u.id}';
       insert into projet_membres(projet_id, profile_id) values('${P}','${u.id}');`);
  return { id: u.id, email, password };
}
const restreinte = await compte("restreinte", `array['/projets','/bookings','/casting','/essayages','/candidatures','/mineurs']`);
const complete = await compte("complete", "null");

const browser = await chromium.launch();
async function session(c) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(BASE + "/login");
  await page.fill("input[type=email]", c.email); await page.fill("input[type=password]", c.password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }), page.locator("form button[type=submit]").first().click()]);
  const morceaux = (await ctx.cookies()).filter((k) => /^sb-.*-auth-token(\.\d+)?$/.test(k.name)).sort((a, b) => a.name.localeCompare(b.name));
  const brut = morceaux.map((k) => decodeURIComponent(k.value)).join("");
  const jeton = JSON.parse(brut.startsWith("base64-") ? Buffer.from(brut.slice(7), "base64url").toString() : brut).access_token;
  const api = async (chemin, init = {}) => {
    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${chemin}`, { ...init, headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${jeton}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  return { ctx, page, api };
}

try {
  const R = await session(restreinte);
  // 1. Lecture directe par l'API avec la session de l'application.
  const lu = await R.api(`figurants?select=id,telephone,adresse&id=in.(${X},${Y},${M})`);
  const ids = (lu.body ?? []).map((r) => r.id);
  check("Sans Base Profils : fiche de la base illisible par l'API", lu.status === 200 && !ids.includes(X) && !ids.includes(M), `HTTP ${lu.status}`);
  check("Sans Base Profils : fiche d'une personne du projet lisible", ids.includes(Y));

  // 2. Liste de choix : noms seuls.
  const choix = await R.api("rpc/figurants_choix", { method: "POST", body: JSON.stringify({ p_ids: [X, M] }) });
  const cx = (choix.body ?? []).find((r) => r.id === X), cm = (choix.body ?? []).find((r) => r.id === M);
  check("Liste de choix : noms seuls, sans coordonnées", choix.status === 200 && cx && Object.keys(cx).sort().join() === "date_naissance,id,nom,prenom" && cx.date_naissance === null);
  check("Liste de choix : date de naissance rendue pour une mineure seulement", !!cm?.date_naissance);
  const anonChoix = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/figurants_choix`, { method: "POST", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, "Content-Type": "application/json" }, body: "{}" });
  check("Liste de choix refusée à la clé publique", anonChoix.status >= 400, `HTTP ${anonChoix.status}`);

  // 3. Les pages gardent la personne dans leurs listes.
  await R.page.goto(`${BASE}/bookings/nouveau?projet_id=${P}`);
  check("Nouveau booking : la personne de la base reste proposée", (await R.page.content()).includes(`${T}Base`));
  await R.page.goto(`${BASE}/bookings/documents?projet_id=${P}&date=${date}`);
  check("Journée de booking : la page s'affiche avec la personne du projet", (await R.page.content()).includes(`${T}Projet`));

  // 4. Booker la personne de la base (vérification serveur + trigger de rattachement).
  const r = await call(R.page, action("src/lib/bookings/actions.ts", "createBookingFromDrop"), [X, P, date, null, "Passant", ""]);
  const booke = one(`select count(*) from bookings where figurant_id='${X}' and projet_id='${P}';`) === "1";
  check("La personne de la base peut être bookée par l'assistante restreinte", booke, booke ? "" : r.text.slice(0, 200));
  const apres = await R.api(`figurants?select=id&id=eq.${X}`);
  check("Une fois bookée, sa fiche devient lisible pour l'équipe du projet", (apres.body ?? []).length === 1);

  // 5. Rattacher par l'API une personne qui n'existe pas dans la base partagée reste refusé.
  const cache = one(`insert into figurants(prenom,nom,telephone,acces_compte,temporaire_projet_id) values('Cachée','${T}Cachee','0600000000',false,null) returning id;`);
  const ins = await R.api("bookings", { method: "POST", body: JSON.stringify({ figurant_id: cache, projet_id: P, date, statut: "en attente" }) });
  check("Rattacher une fiche hors base et hors projet reste refusé", ins.status >= 400 && one(`select count(*) from bookings where figurant_id='${cache}';`) === "0", `HTTP ${ins.status}`);
  await R.ctx.close();

  // 6. Personnel avec la section : inchangé.
  const C = await session(complete);
  const luC = await C.api(`figurants?select=id&id=in.(${M})`);
  check("Avec Base Profils : la base partagée reste lisible", (luC.body ?? []).length === 1);
  await C.ctx.close();
} finally {
  await browser.close();
  psql(`delete from projets where id='${P}'; delete from figurants where nom like '${T}%';`);
  for (const c of [restreinte, complete]) await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${c.id}`, { method: "DELETE", headers: admin });
}
const ko = results.filter((x) => !x.ok);
console.log(`\n${results.length - ko.length}/${results.length} contrôles OK`);
process.exit(ko.length ? 1 : 0);
