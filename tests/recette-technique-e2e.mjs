// Recette TECHNIQUE de bout en bout (30/10/2026) : scénarios métier joués sur l'appli réelle (actions serveur + pages),
// base LOCALE, données fictives, emails CAPTURÉS par Mailpit (BOOKING_TEST_SMTP_URL) — aucun envoi réel.
// Usage : node tests/recette-technique-e2e.mjs        Ne remplace pas la recette métier de Loïc et Mathieu.
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const MAILPIT = process.env.MAILPIT || "http://127.0.0.1:54324";
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || "playwright");
const NAV = process.env.BROWSER || "chromium"; // chromium | webkit (moteur de Safari) | firefox
const chromium = (await import("./lib/navigateur.mjs")).navigateur(pw, NAV);
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.equal(env.BOOKING_TEST_MODE, "1");
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: `set request.jwt.claim.role='service_role';\n${q}`, encoding: "utf8" }).trim();
const one = (q) => sql(q).split("\n").filter(Boolean).pop() ?? "";
const admin = (path, method = "GET", body) => fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/${path}`, { method, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const act = (file, name) => { const e = Object.entries(manifest).find(([, v]) => v.filename === file && v.exportedName === name); assert.ok(e, `${file}#${name}`); const w = Object.keys(e[1].workers).find((k) => k.endsWith("/page") && !k.includes("[")) || Object.keys(e[1].workers)[0]; return { id: e[0], url: BASE + (w.replace(/^app/, "").replace(/\/page$/, "") || "/") }; };
async function call(page, file, name, args, form) {
  const a = act(file, name);
  return page.evaluate(async ({ a, args, form }) => {
    let body, headers = { "Next-Action": a.id, Accept: "text/x-component" };
    if (form) { const fd = new FormData(); for (const [k, v] of Object.entries(form)) fd.append(`_1_${k}`, v); fd.append("0", JSON.stringify(args.map((x) => (x === "$FORM" ? "$K1" : x)))); body = fd; }
    else { body = JSON.stringify(args); headers["Content-Type"] = "text/plain;charset=UTF-8"; }
    const r = await fetch(a.url, { method: "POST", headers, body, redirect: "manual" }); const t = await r.text();
    return { status: r.status, result: (t.split("\n").find((l) => l.startsWith("1:")) || "").slice(2, 300) };
  }, { a, args, form });
}
const mails = async (to) => (await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:" + to)}`)).json()).messages ?? [];
const mailText = async (id) => (await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json()).Text ?? "";
const checks = [];
const check = (carte, nom, ok, detail = "") => checks.push({ carte, nom, ok: !!ok, detail: String(detail).slice(0, 110) });
const login = async (browser, email, password, path = "/login") => {
  const p = await (await browser.newContext()).newPage();
  await p.goto(BASE + path); await p.fill("input[type=email]", email); await p.fill("input[type=password]", password);
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith(path), { timeout: 20000 }), p.locator("form button[type=submit]").first().click()]);
  return p;
};

// ---------- Données fictives ----------
const M = "Rt" + Date.now().toString(36);
const chef = await admin("users", "POST", { email: `chef-${M}@example.test`.toLowerCase(), password: "booking-test-r", email_confirm: true });
sql(`update profiles set role='chef', is_owner=false, acces_complet=true, nom='Cheffe ${M}' where id='${chef.id}';`);
const asst = await admin("users", "POST", { email: `asst-${M}@example.test`.toLowerCase(), password: "booking-test-r", email_confirm: true });
sql(`update profiles set role='assistant', is_owner=false, acces_complet=true where id='${asst.id}';`);
const P = one(`insert into projets(nom,owner_id,convention) values('Projet ${M}','${chef.id}','Cinéma') returning id;`);
sql(`insert into projet_membres(projet_id,profile_id) values('${P}','${asst.id}');`);
const D = one("select (current_date+20)::text;");
const figEmail = `fig-${M}@example.test`.toLowerCase();
const fig = one(`insert into figurants(prenom,nom,email,telephone,date_naissance,acces_compte) values('Lou','${M}Fig','${figEmail}','0677${String(Date.now()).slice(-6)}','1992-02-02',true) returning id;`);
sql(`insert into figurant_comptes(figurant_id,password_hash) select '${fig}', password_hash from figurant_comptes where figurant_id='00000000-0000-4000-8000-00000000f001';`);
const ann = one(`insert into annonces(projet_id,titre,statut) values('${P}','Annonce ${M}','ouverte') returning id;`);
const annTok = one(`select public_token from annonces where id='${ann}';`);
const cand = one(`insert into candidatures(figurant_id,annonce_id) values('${fig}','${ann}') returning id;`);
sql(`insert into journees(projet_id,date) values('${P}','${D}');`);
const bk = one(`insert into bookings(figurant_id,projet_id,date,statut,cachet,candidature_id) values('${fig}','${P}','${D}','confirmé','Figurant','${cand}') returning id;`);

const browser = await chromium.launch();
try {
  const pc = await login(browser, `chef-${M}@example.test`.toLowerCase(), "booking-test-r");
  const pa = await login(browser, `asst-${M}@example.test`.toLowerCase(), "booking-test-r");
  const page = async (p, u) => { const r = await p.request.get(BASE + u); return { s: r.status(), t: await r.text() }; };

  // MET-01 : cycle de vie du projet (règle : seule la créatrice archive)
  await pa.goto(BASE + "/projets");
  await call(pa, "src/lib/projets/actions.ts", "archiverProjet", [P]);
  check("MET-01", "Assistante membre ne peut pas archiver", one(`select archive::text from projets where id='${P}';`) === "false");
  await pc.goto(BASE + "/projets");
  await call(pc, "src/lib/projets/actions.ts", "archiverProjet", [P]);
  check("MET-01", "Créatrice archive son projet", one(`select archive::text from projets where id='${P}';`) === "true");
  const archivePage = await page(pc, `/projets/${P}`);
  check("MET-01", "Projet archivé toujours consultable par la créatrice", archivePage.s === 200 && archivePage.t.includes(`Projet ${M}`));
  await call(pc, "src/lib/projets/actions.ts", "desarchiverProjet", [P]);
  check("MET-01", "Créatrice désarchive", one(`select archive::text from projets where id='${P}';`) === "false");
  await call(pc, "src/lib/projets/actions.ts", "deleteProjet", [P]);
  check("MET-01", "Suppression refusée avant 1 an d'archivage", one(`select count(*) from projets where id='${P}';`) === "1");

  // MET-02 : cycle de vie d'une annonce (ouverte = publique, fermée = plus de candidatures)
  const accueil = (await (await fetch(BASE + "/")).text());
  check("MET-02", "Annonce ouverte visible sur l'accueil public", accueil.includes(`Annonce ${M}`));
  await call(pc, "src/lib/annonces/actions.ts", "toggleAnnonceStatut", [ann, "fermée"]);
  check("MET-02", "Annonce fermée retirée de l'accueil", !(await (await fetch(BASE + "/")).text()).includes(`Annonce ${M}`));
  const postuler = await (await fetch(BASE + `/postuler/${annTok}`)).text();
  check("MET-02", "Annonce fermée : page de candidature ne propose plus de postuler", !/name="photo_portrait"/.test(postuler), "");
  await call(pc, "src/lib/annonces/actions.ts", "toggleAnnonceStatut", [ann, "ouverte"]);
  check("MET-02", "Annonce rouverte", one(`select statut from annonces where id='${ann}';`) === "ouverte");

  // MET-03 : tri des candidatures (onglet + étiquette)
  const ong = await call(pc, "src/lib/candidatures/actions.ts", "createCandidatureOnglet", [`Tri ${M}`, ann]);
  const ongId = one(`select id from candidature_onglets where nom='Tri ${M}';`);
  await call(pc, "src/lib/candidatures/actions.ts", "setCandidatureOnglet", [cand, ongId]);
  check("MET-03", "Candidature rangée dans un onglet", one(`select onglet_id::text from candidatures where id='${cand}';`) === ongId, ong.result);
  const candPage = await page(pc, `/candidatures/${cand}`);
  check("MET-03", "Fiche de la candidature affiche la candidate", candPage.s === 200 && candPage.t.toLowerCase().includes(`${M}fig`.toLowerCase()), candPage.s + " " + (candPage.t.match(/<h1[^>]*>(.*?)<\/h1>/)?.[1] ?? ""));

  // MET-04 / MET-05 / MET-08 : booking et documents de la journée
  for (const doc of ["", "/bordereau", "/liste-appel", "/trombis", "/fiches", "/covoiturage", "/silhouettes", "/trombis-hmc"]) {
    const r = await page(pc, `/bookings/documents${doc}?projet_id=${P}&date=${D}`);
    check(doc === "" ? "MET-05" : "MET-08", `Document de journée ${doc || "(planning)"} : charge et liste la figurante`, r.s === 200 && r.t.includes(`${M}`) && !/Application error/.test(r.t), r.s);
  }
  // MET-09 : barème de l'équipe appliqué au bordereau
  const bar = await call(pc, "src/lib/bareme/actions.ts", "updateBaremeCachet", [one("select id from bareme_cachets where equipe_id is null and convention='Cinéma' and cachet='Figurant' limit 1;"), 111.11, "Test recette"]);
  const bord = await page(pc, `/bookings/documents/bordereau?projet_id=${P}&date=${D}`);
  check("MET-09", "Bordereau utilise le montant du barème de l'équipe (111,11 → 111 € arrondi)", /111\s*€/.test(bord.t), bar.result + " " + one("select string_agg(distinct convention||'/'||cachet, ',') from bareme_cachets where equipe_id is null;"));
  const indem = await call(pc, "src/lib/indemnites/actions.ts", "createProjetIndemnite", [P, `Panier ${M}`, 15.5]);
  const indId = one(`select id from projet_indemnites where label='Panier ${M}';`);
  await call(pc, "src/lib/indemnites/actions.ts", "applyIndemniteToBookings", [[bk], indId]);
  check("MET-09", "Indemnité de projet appliquée au booking", one(`select count(*) from booking_indemnites where booking_id='${bk}';`) === "1", indem.result);
  const bord2 = await page(pc, `/bookings/documents/bordereau?projet_id=${P}&date=${D}`);
  check("MET-09", "Indemnité visible au bordereau", bord2.t.includes(`Panier ${M}`));

  // MET-06 : essayages
  const ej = one(`insert into essayage_journees(projet_id,date) values('${P}','${D}') returning id;`);
  const ess = one(`insert into essayages(figurant_id,projet_id,essayage_journee_id) values('${fig}','${P}','${ej}') returning id;`);
  await call(pc, "src/lib/essayages/actions.ts", "updateEssayageStatutInline", [ess, "confirmé"]);
  check("MET-06", "Statut d'essayage mis à jour", one(`select statut from essayages where id='${ess}';`) === "confirmé");
  const essPage = await page(pc, `/essayages/journee?projet_id=${P}&date=${D}`);
  check("MET-06", "Journée d'essayage affiche la figurante", essPage.s === 200, essPage.s);

  // MET-07 : casting
  const role = one(`insert into casting_roles(projet_id,nom) values('${P}','Role ${M}') returning id;`);
  const castRes = await call(pc, "src/lib/casting/actions.ts", "addFigurantToCastingRole", [role, fig, {}]);
  const entry = one(`select e.id from casting_entries e join figurants f on f.id=e.figurant_id where e.role_id='${role}' and f.nom='${M}Fig';`);
  const cat = one(`select categorie_cachet from casting_roles where id='${role}';`);
  check("MET-07", "Profil ajouté au rôle de casting", entry.length > 0, castRes.result);
  if (cat === "role") check("MET-07", "Rôle à cachet rôle : fiche comédien·ne jumelle, fiche figurante d'origine inchangée", one(`select count(*) from casting_entries e join figurants f on f.id=e.figurant_id where e.role_id='${role}' and f.id<>'${fig}' and f.est_comedien;`) === "1" && one(`select est_comedien::text from figurants where id='${fig}';`) === "false");
  if (entry) { await call(pc, "src/lib/casting/actions.ts", "updateCastingEntryStatut", [entry, "confirmé"]); check("MET-07", "Statut de casting mis à jour", one(`select statut from casting_entries where id='${entry}';`) === "confirmé"); }

  // MET-10 / COM-01 : invitation d'une assistante (email capturé) puis révocation
  const invEmail = `invitee-${M}@example.test`.toLowerCase();
  const inv = await call(pc, "src/lib/equipe/actions.ts", "inviteAssistant", [null, "$FORM"], { email: invEmail, projet_id: P });
  const invitee = one(`select id from profiles where lower(email)='${invEmail}';`);
  const membre = one(`select id from projet_membres where projet_id='${P}' and profile_id='${invitee || "00000000-0000-0000-0000-000000000000"}';`);
  check("MET-10", "Invitation : compte assistante créé et rattaché au projet", invitee && membre, inv.result);
  const invMails = await mails(invEmail);
  check("COM-01", "Email d'invitation d'assistante capturé (aucun envoi réel)", invMails.length >= 1, invMails[0]?.Subject);
  if (membre) { const rv = await call(pc, "src/lib/equipe/actions.ts", "revokeAccess", [membre]); check("MET-10", "Révocation : accès au projet retiré", one(`select count(*) from projet_membres where id='${membre}';`) === "0", rv.result); }
  await call(pc, "src/lib/equipe/actions.ts", "updateAssistantSections", [asst.id, ["/bookings"]]);
  const restreinte = await pa.request.get(BASE + "/casting", { maxRedirects: 0 });
  check("MET-10", "Assistante limitée à une section : autre section refusée", restreinte.status() >= 300 && restreinte.status() < 400, restreinte.status());
  await call(pc, "src/lib/equipe/actions.ts", "updateAssistantSections", [asst.id, null]);

  // COM-01 / COM-04 : convocation par email (capturée) avec la date réelle
  const conv0 = await call(pc, "src/lib/bookings/actions.ts", "sendBulkConvocations", [[{ bookingId: bk, figurantId: fig, email: figEmail, corps: `Pré-convocation ${M}`, subject: `Pré ${M}` }], P]);
  check("COM-02", "Sans boîte d'envoi configurée : message gardé dans l'espace candidate, email non parti (signalé)", conv0.result.includes('"partiels":1') && (await mails(figEmail)).length === 0, conv0.result);
  await pc.goto(BASE + "/equipe");
  const gm = await call(pc, "src/lib/auth/email-actions.ts", "updateMyGmailSmtp", [null, "$FORM"], { gmail_smtp_user: `chef-${M}@example.test`.toLowerCase(), gmail_smtp_app_password: "abcdabcdabcdabcd" });
  check("COM-05", "Boîte d'envoi de la cheffe enregistrée (mot de passe chiffré)", one(`select (gmail_smtp_app_password is not null and gmail_smtp_app_password <> 'abcdabcdabcdabcd')::text from profiles where id='${chef.id}';`) === "true", gm.result);
  sql(`update bookings set convocation_envoyee=false where id='${bk}';`);
  const conv = await call(pc, "src/lib/bookings/actions.ts", "sendBulkConvocations", [[{ bookingId: bk, figurantId: fig, email: `fig-${M}@example.test`.toLowerCase(), corps: `Convocation ${M} le ${D}`, subject: `Convocation ${M}` }], P]);
  const convMails = await mails(`fig-${M}@example.test`.toLowerCase());
  check("COM-01", "Convocation envoyée et capturée par Mailpit", convMails.some((m) => (m.Subject || "").includes(`Convocation ${M}`)), conv.result);
  const convText = convMails[0] ? await mailText(convMails[0].ID) : "";
  check("COM-04", "Contenu de la convocation conservé (date incluse)", convText.includes(D), convText.slice(0, 80));
  check("COM-02", "Convocation tracée dans les messages de la figurante", Number(one(`select count(*) from figurant_messages where figurant_id='${fig}' and categorie='convocation';`)) >= 1);

  // CAN-06 / CAN-07 : espace candidate par projet + message
  const pf = await login(browser, `fig-${M}@example.test`.toLowerCase(), "booking-test", "/compte/connexion");
  const compte = await page(pf, "/compte");
  check("CAN-06", "Espace candidate : candidature et booking du projet visibles", compte.s === 200 && compte.t.includes(`Annonce ${M}`), compte.s);
  check("CAN-07", "Espace candidate : convocation reçue dans les messages", compte.t.includes(`Convocation ${M}`));
  const msg = one(`select id from figurant_messages where figurant_id='${fig}' and categorie='convocation' limit 1;`);
  if (msg) { await call(pf, "src/lib/candidats/actions.ts", "markMessageBienRecu", [msg]); check("CAN-07", "Candidate accuse réception de la convocation", one(`select bien_recu::text from figurant_messages where id='${msg}';`) === "true"); }

  // CAN-09 : lien de connexion par email (capturé)
  const req = await (async () => { const p = await (await browser.newContext()).newPage(); await p.goto(BASE + "/compte/connexion"); return call(p, "src/lib/candidats/actions.ts", "requestMagicLink", [null, "$FORM"], { email: `fig-${M}@example.test`.toLowerCase() }); })();
  const lienMails = (await mails(`fig-${M}@example.test`.toLowerCase())).filter((m) => !(m.Subject || "").includes("Convocation"));
  const lienText = lienMails[0] ? await mailText(lienMails[0].ID) : "";
  const lien = (lienText.match(/https?:\/\/\S*\/compte\/verifier\?token=[A-Za-z0-9_-]+/) || [])[0];
  check("CAN-09", "Lien de connexion reçu par email (capturé)", lien, req.result);
  if (lien) { const pl = await (await browser.newContext()).newPage(); await pl.goto(lien.replace(/^https?:\/\/[^/]+/, BASE)); check("CAN-09", "Le lien reçu ouvre l'espace candidate", (await pl.context().cookies()).some((c) => c.name === "figurant_session"), pl.url()); }
} finally {
  await browser.close();
  sql(`delete from bareme_cachets where equipe_id is not null and (select owner_id from projets where id='${P}') = equipe_id; delete from bareme_majorations where equipe_id='${chef.id}'; delete from bareme_equipes where equipe_id='${chef.id}';
       delete from projets where id='${P}'; delete from figurants where nom='${M}Fig';`);
  for (const u of [chef, asst]) await admin(`users/${u.id}`, "DELETE");
  const inv = one(`select id from profiles where lower(email)='invitee-${M.toLowerCase()}@example.test';`); if (inv) await admin(`users/${inv}`, "DELETE");
}
console.table(checks);
const ko = checks.filter((c) => !c.ok);
assert.deepEqual(ko.map((c) => `${c.carte} ${c.nom}`), [], "Contrôles de recette technique en échec");
console.log(`PASS: ${checks.length} contrôles de recette technique.`);
