// Grande passe de bout en bout (30/10/2026) : TOUTES les pages de l'appli (routes de src/app, paramètres remplis avec
// des données fictives), pour chaque rôle concerné (cheffe propriétaire, assistante membre, candidate, visiteur), à
// 4 largeurs d'écran (320, 375, 768, 1280 px). Relève pour chaque écran :
//  - statut HTTP ≥ 500, page d'erreur Next (« Application error », « This page could not be found » inattendu) ;
//  - erreurs JavaScript (pageerror) et erreurs console ;
//  - requêtes du site en échec (≥ 400 hors redirections/404 attendus) ;
//  - débordement horizontal.
// Usage : node tests/passe-complete.mjs [--json]   (BROWSER / BASE comme les autres tests ; WIDTHS=320,375,768,1280)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const NAV = process.env.BROWSER || "chromium";
const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
const navigateur = (await import("./lib/navigateur.mjs")).navigateur(pw, NAV);
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: `set request.jwt.claim.role='service_role';\n${q}`, encoding: "utf8" }).trim().split("\n").filter(Boolean).pop() ?? "";
const hex = () => randomBytes(32).toString("hex");
const largeurs = (process.env.WIDTHS || "320,375,768,1280").split(",").map(Number);

// ---------- Données fictives (projet de la cheffe du seed, assistante du seed membre) ----------
const M = "Passe" + Date.now().toString(36);
const CHEF = "00000000-0000-4000-8000-00000000c0c0", ASSIST = "00000000-0000-4000-8000-00000000a551", CAND = "00000000-0000-4000-8000-00000000f001";
// Nettoyage garanti même si la préparation échoue (sql est synchrone : utilisable à la sortie du processus).
process.on("exit", () => { try { sql(`delete from projets where nom='Projet ${M}'; delete from figurants where nom like '${M}%'; delete from envois where titre='${M}';`); } catch { /* déjà nettoyé */ } });
const P = sql(`insert into projets(nom,owner_id,societe_production) values('Projet ${M}','${CHEF}','Prod ${M}') returning id;`);
sql(`insert into projet_membres(projet_id,profile_id) values('${P}','${ASSIST}');`);
const D = sql("select (current_date+50)::text;");
const fig = sql(`insert into figurants(prenom,nom,email,telephone,date_naissance,acces_compte) values('Lou','${M}','${M.toLowerCase()}@example.test','0612${String(Date.now()).slice(-6)}','1990-01-01',true) returning id;`);
sql(`insert into figurant_comptes(figurant_id,password_hash) values('${fig}','fixture');`);
const ann = sql(`insert into annonces(projet_id,titre,statut,ouverte_mineurs) values('${P}','Annonce ${M}','ouverte',true) returning id;`);
const annTok = sql(`select public_token from annonces where id='${ann}';`);
sql(`insert into annonce_questions(annonce_id,label,ordre) values('${ann}','Vélo ?',0); insert into annonce_dates(annonce_id,date) values('${ann}','${D}');`);
const cand = sql(`insert into candidatures(figurant_id,annonce_id) values('${fig}','${ann}') returning id;`);
sql(`insert into candidatures(figurant_id,annonce_id) values('${CAND}','${ann}') on conflict do nothing;`);
sql(`insert into journees(projet_id,date) values('${P}','${D}');`);
const bk = sql(`insert into bookings(figurant_id,projet_id,date,statut,cachet) values('${fig}','${P}','${D}','confirmé','Figurant') returning id;`);
sql(`insert into bookings(figurant_id,projet_id,date,statut,cachet) values('${CAND}','${P}','${D}','confirmé','Figurant');`);
const ej = sql(`insert into essayage_journees(projet_id,date) values('${P}','${D}') returning id;`);
const ess = sql(`insert into essayages(figurant_id,projet_id,essayage_journee_id,statut) values('${fig}','${P}','${ej}','confirmé') returning id;`);
const role = sql(`insert into casting_roles(projet_id,nom,lien_public_actif) values('${P}','Role ${M}',true) returning id;`);
const rolePublic = sql(`select public_token from casting_roles where id='${role}';`);
const entryReq = sql(`insert into casting_entries(projet_id,figurant_id,role_id,visible_partage) values('${P}','${fig}','${role}',true) returning request_token;`);
const T = { documents: hex(), essayages: hex(), casting: hex(), journee: hex() };
sql(`insert into partage_liens(projet_id,type,token) values('${P}','documents','${T.documents}'),('${P}','essayages','${T.essayages}'),('${P}','casting','${T.casting}');
     insert into partage_journee_liens(projet_id,date,token,show_contacts) values('${P}','${D}','${T.journee}',false);`);
const valTok = sql(`insert into liens_validation(projet_id,nom,annonce_id) values('${P}','Validation ${M}','${ann}') returning token;`);
const dispo = sql(`select token_disponibilite from figurants where id='${fig}';`);
const envoi = sql(`insert into envois(projet_id,titre,corps,canal) values('${P}','${M}','x','email') returning id;`);
const recu = sql(`insert into envoi_destinataires(envoi_id,figurant_id) values('${envoi}','${fig}') returning token;`);
const enfant = sql(`insert into figurants(prenom,nom,email,date_naissance) values('Enfant','${M}E','${M.toLowerCase()}e@example.test',(current_date - interval '12 years')::date) returning id;`);
const dossier = sql(`insert into minor_dossiers(projet_id,figurant_id,tournage_debut,tournage_fin,commission_date,role_label,cachet_info) values('${P}','${enfant}','${D}','${D}',current_date+10,'Écolière','Cachet') returning id;`);
const depot = hex(), prod = hex();
const h = (t) => createHash("sha256").update(t).digest("hex");
sql(`insert into minor_links(dossier_id,token_hash,kind) values('${dossier}','${h(depot)}','guardian_1'),('${dossier}','${h(prod)}','production');`);

const staff = ["/", "/projets", `/projets/${P}`, `/projets/${P}/modifier`, "/projets/nouveau", `/projets/${P}/mineurs`, `/projets/${P}/mineurs/${dossier}/autorisation`,
  `/projets/${P}/mineurs/${dossier}/dossier`, "/annonces", `/annonces/${ann}`, `/annonces/${ann}/modifier`, "/annonces/nouveau", "/candidatures", `/candidatures?annonce_id=${ann}`,
  `/candidatures/${cand}`, `/candidatures/documents/fiches?annonce_id=${ann}`, `/candidatures/documents/trombis?annonce_id=${ann}`, "/bookings", `/bookings?projet_id=${P}&date=${D}`,
  `/bookings/${bk}`, `/bookings/${bk}/modifier`, "/bookings/nouveau", "/bookings/reserve", "/bookings/resume",
  ...["", "/bordereau", "/covoiturage", "/fiches", "/liste-appel", "/silhouettes", "/trombis", "/trombis-hmc"].map((d) => `/bookings/documents${d}?projet_id=${P}&date=${D}`),
  "/casting", `/casting?projet_id=${P}`, "/casting/distribution", "/casting/fiches-roles", "/casting/liste-artistique", "/casting/presentiel", "/casting/presentiel/journee",
  "/casting/presentiel/journee/planning", "/casting/trombis", "/essayages", `/essayages/${ess}`, `/essayages/${ess}/modifier`, "/essayages/nouveau",
  `/essayages/journee?projet_id=${P}&date=${D}`, `/essayages/documents/suivi?projet_id=${P}`, "/figurants", "/figurants?vue=liste", `/figurants/${fig}`, `/figurants/${fig}/fiche`,
  `/figurants/${fig}/modifier`, "/figurants/fiches", "/figurants/nouveau", "/equipe", "/bareme", "/modeles", "/mineurs", "/mon-compte", "/aide", "/partage", "/rgpd",
  "/admin", "/admin/agents", "/admin/references", "/admin/support"];
const publics = ["/", "/login", "/compte/connexion", "/compte/inscription", "/compte/creer", "/auth/forgot-password", "/auth/reset-password", "/auth/invite", "/confidentialite",
  "/offline", `/postuler/${annTok}`, `/casting/rejoindre/${rolePublic}`, `/casting/upload/${entryReq}`, `/disponibilites/${dispo}`, `/recu/${recu}`,
  `/partage/documents/${T.documents}`, `/partage/documents/${T.documents}/fiches?date=${D}`, `/partage/documents/${T.documents}/trombis?date=${D}`, `/partage/documents/${T.journee}`,
  `/partage/essayages/${T.essayages}`, `/partage/essayages/${T.essayages}/fiches?date=${D}`, `/partage/essayages/${T.essayages}/planning?date=${D}`,
  `/partage/casting/${T.casting}`, `/partage/casting/${T.casting}/distribution`, `/partage/casting/${T.casting}/fiches-mensuration`, `/partage/casting/${T.casting}/fiches-roles`,
  `/partage/casting/${T.casting}/liste-artistique`, `/partage/validation/${valTok}`, `/mineurs/depot/${depot}`, `/mineurs/partage/${prod}`];
const assistante = ["/", "/projets", `/projets/${P}`, "/candidatures", `/candidatures/${cand}`, "/bookings", `/bookings?projet_id=${P}&date=${D}`, `/bookings/documents/bordereau?projet_id=${P}&date=${D}`,
  "/casting", "/essayages", "/figurants", `/figurants/${fig}`, "/mineurs", `/projets/${P}/mineurs`, "/mon-compte", "/aide"];
const candidate = ["/compte", "/", `/postuler/${annTok}`];

const audit = () => {
  const vw = document.documentElement.clientWidth;
  const texte = document.body?.innerText || "";
  let coupable = "";
  const overflow = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;
  if (overflow > 1) {
    let pire = null;
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) continue;
      let p = el.parentElement, clippe = false;
      while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") { clippe = true; break; } p = p.parentElement; }
      if (!clippe && (!pire || r.right > pire.r)) pire = { r: r.right, d: `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 4).join(".")} « ${(el.textContent || "").trim().slice(0, 25)} »` };
    }
    coupable = pire?.d || "";
  }
  return { overflow, coupable,
    erreurNext: /Application error|Internal Server Error|Unhandled Runtime Error/.test(texte), introuvable: /This page could not be found|404/.test(document.title + " " + texte.slice(0, 200)) };
};
const lignes = [];
const browser = await navigateur.launch();
try {
  const ouvrir = async (width, loginPath, email) => {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, ...(width < 800 ? { isMobile: NAV !== "firefox", hasTouch: true } : {}) });
    const p = await ctx.newPage();
    if (loginPath) {
      await p.goto(BASE + loginPath); await p.fill("input[type=email]", email); await p.fill("input[type=password]", "booking-test");
      await Promise.all([p.waitForURL((u) => !u.pathname.startsWith(loginPath), { timeout: 30000 }), p.locator("form button[type=submit]").first().click()]);
    }
    return p;
  };
  for (const width of largeurs) {
    sql("delete from candidate_auth_attempts;");
    const groupes = [["cheffe", await ouvrir(width, "/login", "cheffe.test@test-chat-charge.fr"), staff], ["assistante", await ouvrir(width, "/login", "assistante.test@test-chat-charge.fr"), assistante],
      ["candidate", await ouvrir(width, "/compte/connexion", "candidate.test@test-figurant.fr"), candidate], ["public", await ouvrir(width), publics]];
    for (const [role, page, routes] of groupes) {
      for (const route of routes) {
        const erreursJs = [], requetes = [];
        const onErr = (e) => erreursJs.push(e.message.slice(0, 120));
        const onCons = (m) => { if (m.type() === "error" && !/favicon|manifest|Failed to load resource/.test(m.text())) erreursJs.push("console: " + m.text().slice(0, 120)); };
        const onResp = (r) => { const u = r.url(); if (u.startsWith(BASE) && r.status() >= 400 && r.status() !== 404 && !u.includes("/_next/image")) requetes.push(`${r.status()} ${u.slice(BASE.length, BASE.length + 70)}`); };
        page.on("pageerror", onErr); page.on("console", onCons); page.on("response", onResp);
        const t0 = Date.now();
        const res = await page.goto(BASE + route, { waitUntil: "load", timeout: 45000 }).catch((e) => ({ status: () => 0, err: e.message.slice(0, 80) }));
        const chargement = Date.now() - t0;
        await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(300);
        const a = await page.evaluate(audit).catch(() => ({ overflow: 0, erreurNext: true, introuvable: false }));
        page.off("pageerror", onErr); page.off("console", onCons); page.off("response", onResp);
        const status = res?.status?.() ?? 0;
        const problemes = [];
        if (status >= 500 || status === 0) problemes.push(`HTTP ${status}${res?.err ? " " + res.err : ""}`);
        if (a.erreurNext) problemes.push("page d'erreur");
        if (a.introuvable && status !== 404) problemes.push("page introuvable");
        if (erreursJs.length) problemes.push("JS: " + erreursJs.slice(0, 2).join(" | "));
        if (requetes.length) problemes.push("requêtes: " + requetes.slice(0, 3).join(", "));
        if (a.overflow > 1) problemes.push(`débordement +${a.overflow}px ${a.coupable || ""}`);
        lignes.push({ largeur: width, role, route, http: status, arrivee: new URL(page.url()).pathname, problemes, chargement });
      }
      await page.context().close();
    }
  }
} finally {
  await browser.close();
  sql(`delete from projets where id='${P}'; delete from figurants where nom like '${M}%'; delete from envois where titre='${M}';`);
}
if (process.argv.includes("--json")) console.log(JSON.stringify(lignes, null, 1));
const ko = lignes.filter((l) => l.problemes.length);
console.log(`${lignes.length} visites (${new Set(lignes.map((l) => l.route)).size} adresses, ${largeurs.length} largeurs, 4 rôles, ${NAV}). Problèmes : ${ko.length}.`);
for (const l of ko) console.log(`KO ${l.role}@${l.largeur} ${l.route} → ${l.arrivee} :: ${l.problemes.join(" ; ")}`);
// Fluidité : temps jusqu'à l'événement « load » (appli construite, base locale). Les 8 écrans les plus lents.
const lents = [...lignes].sort((a, b) => b.chargement - a.chargement).slice(0, 8);
console.log(`Chargement médian : ${[...lignes].map((l) => l.chargement).sort((a, b) => a - b)[Math.floor(lignes.length / 2)]} ms. Plus lents :`);
for (const l of lents) console.log(`  ${l.chargement} ms  ${l.role}@${l.largeur} ${l.route.replace(/\?.*$/, "")}`);
assert.equal(ko.length, 0, "La passe complète a trouvé des problèmes");
console.log("PASS: passe complète sans erreur.");
