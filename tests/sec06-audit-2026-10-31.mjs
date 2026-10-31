// SEC-06 — non-régression de l'audit sécurité du 31/10/2026, en attaquant l'application LOCALE comme un tiers le ferait.
// Base et application locales uniquement (BOOKING_TEST_MODE=1), données fictives créées puis supprimées.
// Pré-requis : `npm run build && npm start` (port 3000), Supabase local avec seed, Mailpit (BOOKING_TEST_SMTP_URL).
// Usage : node tests/sec06-audit-2026-10-31.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const DB = process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS";
const MAILPIT = process.env.MAILPIT || "http://127.0.0.1:54324";
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
// Appel direct d'une Server Action depuis la page (cookies de la session), comme un attaquant le ferait sans l'interface.
async function call(page, a, args, form) {
  return page.evaluate(async ({ url, id, args, form }) => {
    const headers = { "Next-Action": id, Accept: "text/x-component" };
    let body;
    if (form) {
      const fd = new FormData(); const root = [...args]; root[form.index] = "$K1";
      for (const [n, v] of Object.entries(form.fields)) fd.append(`_1_${n}`, v);
      fd.append("0", JSON.stringify(root)); body = fd;
    } else { body = JSON.stringify(args); headers["Content-Type"] = "text/plain;charset=UTF-8"; }
    const res = await fetch(url, { method: "POST", headers, body, redirect: "manual" });
    const text = await res.text();
    return { status: res.status, redirect: res.headers.get("x-action-redirect"), text };
  }, { url: a.url, id: a.id, args, form });
}

const T = "SEC06-" + Date.now();
const SEED_CHEF = "00000000-0000-4000-8000-00000000c0c0";
const results = [];
const check = (nom, ok, detail = "") => { results.push({ nom, ok }); console.log(`${ok ? "OK " : "KO "} ${nom}${detail ? " — " + detail : ""}`); };

// ---------- Données fictives ----------
const P_A = one(`insert into projets(nom, owner_id) values('${T} projet A','${SEED_CHEF}') returning id;`);
const dateA = one(`select (current_date+40)::text;`);
const emailCompte = `${T.toLowerCase()}-compte@example.test`;
const FIG = one(`insert into figurants(prenom,nom,email,telephone,date_naissance,adresse,code_postal,ville,commune_naissance,genre,pronom,acces_compte)
  values('Camille','${T}','${emailCompte}','0611${String(Date.now()).slice(-6)}','1990-05-05','1 rue Fictive','75001','Paris','Paris','Femme','Elle',true) returning id;`);
const journeeA = one(`insert into essayage_journees(projet_id,date) values('${P_A}','${dateA}') returning id;`);
const msgSansProjet = one(`insert into figurant_messages(figurant_id,sender,corps) values('${FIG}','figurant','${T} réponse privée') returning id;`);
const emailActeur = `${T.toLowerCase()}-acteur@example.test`;
const ACTEUR = one(`insert into figurants(prenom,nom,email,telephone,date_naissance,ville,est_comedien,comedien_pool_id,confirme)
  values('Alix','${T}Acteur','${emailActeur}','0622000000','1985-03-03','Lyon',true,'${SEED_CHEF}',true) returning id;`);
const roleTok = one(`insert into casting_roles(projet_id,nom,lien_public_actif) values('${P_A}','${T} rôle',true) returning public_token;`);

const B_EMAIL = `${T.toLowerCase()}-cheffe-b@example.test`, B_PASS = "booking-test-b";
const admin = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const created = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email: B_EMAIL, password: B_PASS, email_confirm: true }) }).then((r) => r.json());
assert.ok(created.id, "Création de la cheffe B impossible");
const B = created.id;
svc(`update profiles set role='chef', is_owner=false, nom='Cheffe B fictive' where id='${B}';`);
const P_B = one(`insert into projets(nom, owner_id) values('${T} projet B','${B}') returning id;`);

const browser = await chromium.launch();
try {
  // 1. RPC SECURITY DEFINER appelable avec la clé publique.
  const rpc = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/enregistrer_fonction_projet`, {
    method: "POST", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_projet: P_A, p_nom: `${T}-intrus` }),
  });
  check("RPC enregistrer_fonction_projet refusée à la clé publique", rpc.status >= 400 && one(`select count(*) from projet_fonctions where nom like '${T}%';`) === "0", `HTTP ${rpc.status}`);

  // Cheffe B connectée (autre équipe, non propriétaire globale).
  const ctxB = await browser.newContext();
  const page = await ctxB.newPage();
  await page.goto(BASE + "/login");
  await page.fill("input[type=email]", B_EMAIL); await page.fill("input[type=password]", B_PASS);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }), page.locator("form button[type=submit]").first().click()]);

  // 2. Prise de compte : changer l'email d'une fiche reliée à un compte candidat, depuis une autre équipe.
  const maj = action("src/lib/figurants/actions.ts", "updateFigurantInline");
  const champs = { prenom: "Camille", nom: T, email: emailCompte, telephone: "0611000000", adresse: "1 rue Fictive", code_postal: "75001", ville: "Paris", commune_naissance: "Paris", genre: "Femme", pronom: "Elle" };
  await call(page, maj, [FIG, null, null], { index: 2, fields: { ...champs, email: `${T.toLowerCase()}-pirate@example.test` } });
  check("Email d'un compte candidat non modifiable par une autre équipe", one(`select email from figurants where id='${FIG}';`) === emailCompte);
  await call(page, maj, [FIG, null, null], { index: 2, fields: { ...champs, est_comedien: "on" } });
  check("Compte candidat non basculable en comédien·ne", one(`select est_comedien::text from figurants where id='${FIG}';`) === "false");
  await call(page, maj, [FIG, null, null], { index: 2, fields: { ...champs, ville: "Lille" } });
  check("La base partagée reste modifiable (autres champs)", one(`select ville from figurants where id='${FIG}';`) === "Lille");

  // 3. Réponses mail/SMS sans projet : plus visibles par une autre équipe.
  const replies = await call(page, action("src/lib/bookings/inbox-actions.ts", "checkEmailReplies"), [P_B]);
  check("Réponses sans projet d'une autre équipe non divulguées", !replies.text.includes(`${T} réponse privée`));
  await call(page, action("src/lib/bookings/inbox-actions.ts", "marquerReponseLueGmail"), [msgSansProjet]);
  check("Réponse sans projet non traitable par une autre équipe", one(`select count(*) from figurant_messages where id='${msgSansProjet}' and reviewed_at is not null;`) === "0");

  // 4. Rattachement à la journée d'essayage d'une autre équipe.
  await call(page, action("src/lib/essayages/actions.ts", "addFigurantToEssayageJournee"), [journeeA, FIG, P_B, dateA, null, null]);
  check("Essayage non rattachable à la journée d'une autre équipe", one(`select count(*) from essayages where essayage_journee_id='${journeeA}';`) === "0");
  await ctxB.close();

  // 5. Casting sans compte : email + nom d'un·e comédien·ne ne suffisent plus à ouvrir sa page d'envoi.
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(`${BASE}/casting/rejoindre/${roleTok}`);
  const casting = action("src/lib/casting/rejoindre-actions.ts", "postulerCastingSansCompte");
  const r = await call(anon, casting, [roleTok, null, null], { index: 2, fields: { prenom: "Intrus", nom: `${T}Acteur`, email: emailActeur, telephone: "0699999999" } });
  const tokenVictime = one(`select request_token from casting_entries where figurant_id='${ACTEUR}';`);
  check("Page d'envoi d'un·e comédien·ne non ouverte à un tiers", !(r.redirect ?? "").includes("/casting/upload/") && !r.text.includes(tokenVictime ?? "∅"));
  let recu = false;
  for (let i = 0; i < 20 && !recu; i++) {
    const m = (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:" + emailActeur)}`)).json()).messages ?? [];
    recu = m.length > 0; if (!recu) await new Promise((res) => setTimeout(res, 500));
  }
  check("Le lien d'envoi part à l'adresse enregistrée", recu);
  // Nouvelle personne : le parcours sans compte reste direct.
  const nouvelle = await call(anon, casting, [roleTok, null, null], { index: 2, fields: { prenom: "Nouvelle", nom: `${T}Neuve`, email: `${T.toLowerCase()}-neuve@example.test`, telephone: "0688888888" } });
  check("Une nouvelle personne arrive toujours directement sur sa page d'envoi", (nouvelle.redirect ?? nouvelle.text).includes("/casting/upload/"));

} finally {
  await browser.close();
  psql(`delete from projets where id in ('${P_A}','${P_B}'); delete from figurant_messages where corps like '${T}%'; delete from figurants where nom like '${T}%';`);
  await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${B}`, { method: "DELETE", headers: admin });
}
const ko = results.filter((r) => !r.ok);
console.log(`\n${results.length - ko.length}/${results.length} contrôles OK`);
process.exit(ko.length ? 1 : 0);
