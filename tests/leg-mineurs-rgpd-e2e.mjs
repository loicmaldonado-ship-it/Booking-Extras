// LEG-01..05 (30/10/2026) : parcours mineurs et RGPD de bout en bout sur l'appli réelle (base locale, données fictives).
// - LEG-04 : règles d'âge à la candidature (moins de 16 ans, annonce ouverte ou non aux mineurs, anniversaires frontières).
// - LEG-01 : représentants légaux obligatoires pour un mineur, emails distincts, absence motivée du second.
// - LEG-02/03 : dossier mineur (dates, commission DRIEETS), pièces demandées, lien de dépôt parent, dépôt, validation,
//   lien de partage production, révocation, page de préparation DRIEETS.
// - LEG-05 : anonymisation par la propriétaire d'un profil avec candidature, booking, messages, photos et dossier mineur.
// Usage : node tests/leg-mineurs-rgpd-e2e.mjs   (appli sur :3000)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || "playwright");
const NAV = process.env.BROWSER || "chromium"; // chromium | webkit (moteur de Safari) | firefox
const chromium = pw[NAV];
const sharp = require("sharp");
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.equal(env.BOOKING_TEST_MODE, "1");
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: `set request.jwt.claim.role='service_role';\n${q}`, encoding: "utf8" }).trim().split("\n").filter(Boolean).pop() ?? "";
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const actionId = (file, name) => { const e = Object.entries(manifest).find(([, v]) => v.filename === file && v.exportedName === name); assert.ok(e, `${file}#${name}`); return e[0]; };
// Appel d'action : url = page d'origine réelle ; args = arguments liés ; form = champs (FormData) ; files = fichiers base64.
const call = (page, url, file, name, args, form, files = []) => page.evaluate(async ({ id, url, args, form, files }) => {
  let body, headers = { "Next-Action": id, Accept: "text/x-component" };
  if (form) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) fd.append(`_1_${k}`, v);
    for (const f of files) fd.append(`_1_${f.champ}`, new File([Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0))], f.nom, { type: f.type }));
    fd.append("0", JSON.stringify([...args, "$K1"].map((x) => x)));
    body = fd;
  } else { body = JSON.stringify(args); headers["Content-Type"] = "text/plain;charset=UTF-8"; }
  const r = await fetch(url, { method: "POST", headers, body, redirect: "manual" });
  const t = await r.text();
  return { status: r.status, result: (t.split("\n").find((l) => l.startsWith("1:")) || "").slice(2, 400) };
}, { id: actionId(file, name), url, args, form, files });

const checks = [];
const check = (carte, nom, ok, detail = "") => checks.push({ carte, nom, ok: !!ok, detail: String(detail).slice(0, 110) });
const M = "Leg" + Date.now().toString(36);
const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
const ilYa = (ans, jours = 0) => { const d = new Date(today); d.setFullYear(d.getFullYear() - ans); d.setDate(d.getDate() + jours); return d.toISOString().slice(0, 10); };
const jpeg = (await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#a08070" } }).jpeg().toBuffer()).toString("base64");
const photos = ["photo_portrait", "photo_pied", "photo_selfie"].map((champ) => ({ champ, nom: `${champ}.jpg`, type: "image/jpeg", b64: jpeg }));
const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF").toString("base64");
let n = 0;
const candidate = (naissance, over = {}) => {
  n += 1;
  return { prenom: "Enfant", nom: `${M}${n}`, email: `${M.toLowerCase()}-${n}@example.test`, telephone: `0645${String(Date.now() + n).slice(-6)}`, ville: "Paris",
    adresse: "1 rue Fictive", code_postal: "75001", date_naissance: naissance, commune_naissance: "Paris", genre: "Femme", pronom: "Elle", message: "Bonjour",
    taille_cm: "150", poids_kg: "40", pointure: "36", veste: "S", pantalon: "34", selfie_date: new Date().toISOString().slice(0, 10), a_vehicule: "non",
    sans_agent: "on", password: "motdepasse-fictif-123", password_confirmation: "motdepasse-fictif-123", ...over };
};
const parents = (childN, over = {}) => ({ guardian_1_prenom: "Paul", guardian_1_nom: `${M}P1`, guardian_1_adresse: "1 rue Fictive 75001 Paris", guardian_1_telephone: "0611223344",
  guardian_1_email: `${M.toLowerCase()}-p1-${childN}@example.test`, guardian_2_prenom: "Anne", guardian_2_nom: `${M}P2`, guardian_2_adresse: "2 rue Fictive 75001 Paris",
  guardian_2_telephone: "0622334455", guardian_2_email: `${M.toLowerCase()}-p2-${childN}@example.test`, ...over });

const owner = sql("select id from profiles where email='cheffe.test@test-chat-charge.fr';");
const P = sql(`insert into projets(nom,owner_id) values('Projet ${M}','${owner}') returning id;`);
const annFermee = sql(`insert into annonces(projet_id,titre,statut,ouverte_mineurs) values('${P}','Adultes ${M}','ouverte',false) returning public_token;`);
const annMineurs = sql(`insert into annonces(projet_id,titre,statut,ouverte_mineurs) values('${P}','Mineurs ${M}','ouverte',true) returning public_token;`);

const browser = await chromium.launch();
try {
  const anon = async () => (await browser.newContext()).newPage();
  const postuler = async (tok, champs) => { const p = await anon(); await p.goto(`${BASE}/postuler/${tok}`); const r = await call(p, `/postuler/${tok}`, "src/lib/candidatures/actions.ts", "postulerAnnonce", [tok, null], champs, photos); await p.context().close(); return r; };
  const idPar = (champs) => sql(`select id from figurants where lower(email)='${champs.email}';`);

  // ---------- LEG-04 : âge ----------
  let c = candidate(ilYa(14));
  let r = await postuler(annFermee, { ...c, ...parents(n) });
  check("LEG-04", "14 ans sur annonce non ouverte aux mineurs : refus", /moins de 16 ans/.test(r.result) && !idPar(c), r.result);
  c = candidate(ilYa(16, 1));
  r = await postuler(annFermee, { ...c, ...parents(n) });
  check("LEG-04", "16 ans demain (15 ans aujourd'hui) : refus", /moins de 16 ans/.test(r.result), r.result);
  c = candidate(ilYa(16));
  r = await postuler(annFermee, { ...c, ...parents(n) });
  check("LEG-04", "16 ans aujourd'hui : accepté sur annonce non ouverte aux mineurs", /"success":true/.test(r.result) && idPar(c), r.result);
  c = candidate(ilYa(12));
  const enfant = c;
  const enfantN = n;
  r = await postuler(annMineurs, { ...c, ...parents(n) });
  check("LEG-04", "12 ans sur annonce ouverte aux mineurs : accepté", /"success":true/.test(r.result) && idPar(c), r.result);
  c = candidate(ilYa(18));
  r = await postuler(annFermee, c);
  check("LEG-04", "18 ans aujourd'hui : majeur, aucun représentant demandé", /"success":true/.test(r.result), r.result);
  c = candidate(ilYa(18, 1));
  r = await postuler(annFermee, c);
  check("LEG-04", "18 ans demain : encore mineur, représentants exigés", /représentant légal 1/.test(r.result), r.result);

  // ---------- LEG-01 : représentants légaux ----------
  c = candidate(ilYa(17));
  r = await postuler(annFermee, { ...c, ...parents(n, { guardian_1_email: c.email }) });
  check("LEG-01", "Représentant avec l'email de l'enfant : refus", /adresses email diff/.test(r.result), r.result);
  r = await postuler(annFermee, { ...c, ...parents(n, { guardian_2_email: parents(n).guardian_1_email }) });
  check("LEG-01", "Deux représentants avec le même email : refus", /adresses email diff/.test(r.result), r.result);
  r = await postuler(annFermee, { ...c, ...parents(n, { guardian_2_prenom: "", guardian_2_absence_reason: "decede" }) });
  const ado = idPar(c);
  check("LEG-01", "Second représentant absent pour motif valable (décédé) : accepté", /"success":true/.test(r.result) && ado, r.result);
  check("LEG-01", "Représentants enregistrés sur la fiche (1 contact + 1 absence motivée)", sql(`select count(*)||'/'||count(absence_reason) from minor_guardians where figurant_id='${ado}';`) === "2/1");
  const enfantId = idPar(enfant);
  check("LEG-01", "Deux représentants complets enregistrés pour l'enfant de 12 ans", sql(`select count(*) from minor_guardians where figurant_id='${enfantId}' and absence_reason is null;`) === "2");

  // ---------- LEG-02 / LEG-03 : dossier mineur ----------
  const staff = await (await browser.newContext()).newPage();
  await staff.goto(BASE + "/login");
  await staff.fill("input[type=email]", "cheffe.test@test-chat-charge.fr"); await staff.fill("input[type=password]", "booking-test");
  await Promise.all([staff.waitForURL((u) => !u.pathname.startsWith("/login")), staff.locator("form button[type=submit]").first().click()]);
  const pageMineurs = `/projets/${P}/mineurs`;
  await staff.goto(BASE + pageMineurs);
  const MA = "src/lib/minors/actions.ts";
  r = await call(staff, pageMineurs, MA, "createMinorDossier", [P, null], { figurant_id: enfantId });
  const dossier = sql(`select id from minor_dossiers where projet_id='${P}' and figurant_id='${enfantId}';`);
  check("LEG-02", "Dossier mineur créé pour l'enfant", dossier, r.status);
  r = await call(staff, pageMineurs, MA, "createMinorDossier", [P, null], { figurant_id: idPar(candidate(ilYa(30))) || "00000000-0000-4000-8000-00000000f001" });
  check("LEG-02", "Dossier refusé pour un profil majeur", /mineur/.test(r.result), r.result);
  const fin = new Date(today); fin.setDate(fin.getDate() + 40);
  const debut = new Date(today); debut.setDate(debut.getDate() + 30);
  const comm = new Date(today); comm.setDate(comm.getDate() + 10);
  const iso = (d) => d.toISOString().slice(0, 10);
  r = await call(staff, pageMineurs, MA, "saveMinorDates", [dossier, null], { tournage_debut: iso(fin), tournage_fin: iso(debut), commission_date: iso(comm), role_label: "Écolière", cachet_info: "Cachet" });
  check("LEG-03", "Période de tournage inversée : refus", /inversée/.test(r.result), r.result);
  r = await call(staff, pageMineurs, MA, "saveMinorDates", [dossier, null], { tournage_debut: iso(debut), tournage_fin: iso(fin), commission_date: iso(comm), role_label: "Écolière", cachet_info: "Cachet journalier" });
  check("LEG-03", "Dates de tournage et de commission DRIEETS enregistrées", sql(`select commission_date::text from minor_dossiers where id='${dossier}';`) === iso(comm), r.result);
  r = await call(staff, pageMineurs, MA, "addMinorRequirement", [P, null], { label: `Certificat médical ${M}`, required: "on" });
  const exigence = sql(`select id from minor_requirements where projet_id='${P}' and label='Certificat médical ${M}';`);
  check("LEG-02", "Pièce demandée ajoutée aux dossiers du projet", exigence, r.result);
  r = await call(staff, pageMineurs, MA, "createMinorLink", [dossier, null], { kind: "guardian_1" });
  const lienDepot = (r.result.match(/\/mineurs\/depot\/([0-9a-f]{64})/) || [])[1];
  check("LEG-02", "Lien de dépôt pour le représentant 1 créé", lienDepot, r.result.slice(0, 80));
  const parent = await anon();
  const pageDepot = await parent.goto(`${BASE}/mineurs/depot/${lienDepot}`);
  const texteDepot = await parent.content();
  check("LEG-02", "Page de dépôt ouverte sans compte, sans autre dossier visible", pageDepot.status() === 200 && /Certificat médical/.test(texteDepot) && !/cheffe\.test@/.test(texteDepot), pageDepot.status());
  r = await call(parent, `/mineurs/depot/${lienDepot}`, MA, "uploadMinorDocument", [lienDepot, null], { source_key: "guardian_1" }, [{ champ: "file", nom: "autorisation.pdf", type: "application/pdf", b64: pdf }]);
  check("LEG-02", "Autorisation signée déposée par le représentant", /Fichier reçu/.test(r.result), r.result);
  r = await call(parent, `/mineurs/depot/${lienDepot}`, MA, "uploadMinorDocument", [lienDepot, null], { source_key: `extra_${exigence}` }, [{ champ: "file", nom: "faux.pdf", type: "application/pdf", b64: Buffer.from("pas un pdf").toString("base64") }]);
  check("LEG-02", "Faux PDF refusé au dépôt", !/Fichier reçu/.test(r.result), r.result);
  const doc = sql(`select d.id||'|'||d.storage_path||'|'||coalesce(public.minor_guardian_fingerprint(x.figurant_id,1),'') from minor_documents d join minor_dossiers x on x.id=d.dossier_id where d.dossier_id='${dossier}' and d.source_key='guardian_1';`).split("|");
  await staff.goto(`${BASE}/projets/${P}/mineurs/${dossier}/autorisation`).catch(() => {});
  r = await call(staff, pageMineurs, MA, "reviewMinorDocument", [dossier, doc[0], doc[1], doc[2] || null, null], { state: "validated", valid_until: "", internal_note: "Signature vérifiée" });
  check("LEG-02", "Autorisation validée par l'équipe", sql(`select state from minor_documents where id='${doc[0]}';`) === "validated", r.result);
  r = await call(staff, pageMineurs, MA, "createMinorLink", [dossier, null], { kind: "production" });
  const lienProd = (r.result.match(/\/mineurs\/partage\/([0-9a-f]{64})/) || [])[1];
  const prod = await anon();
  const pageProd = await prod.goto(`${BASE}/mineurs/partage/${lienProd}`);
  check("LEG-03", "Lien de partage production : dossier et autorisation validée visibles", pageProd.status() === 200 && /Autorisation parentale 1/.test(await prod.content()), pageProd.status());
  const texte = async () => (await staff.content()).replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  await staff.goto(`${BASE}/projets/${P}/mineurs/${dossier}/dossier`);
  const sansSociete = await texte();
  check("LEG-03", "Préparation DRIEETS bloquée et explicite tant que la société de production manque", /ne peut pas être générée/.test(sansSociete) && /société de production/.test(sansSociete), sansSociete.slice(0, 80));
  sql(`update projets set societe_production='Production ${M}' where id='${P}';`);
  const prep = await staff.goto(`${BASE}/projets/${P}/mineurs/${dossier}/dossier`);
  const prepTxt = (await texte()).toLowerCase();
  check("LEG-03", "Préparation du dossier DRIEETS générée (enfant, représentants, commission, pièce validée)", prep.status() === 200 && !/ne peut pas être générée/.test(prepTxt)
    && prepTxt.includes(`${M}${enfantN}`.toLowerCase()) && prepTxt.includes(`${M}p1`.toLowerCase()) && prepTxt.includes(iso(comm).split("-").reverse().join("/")) && /validée/.test(prepTxt), prepTxt.slice(0, 120));
  r = await call(staff, pageMineurs, MA, "revokeMinorLinks", [dossier]);
  const apres = await (await anon()).goto(`${BASE}/mineurs/depot/${lienDepot}`);
  const apresProd = await (await anon()).goto(`${BASE}/mineurs/partage/${lienProd}`);
  const pagesRevoquees = [apres, apresProd];
  const contenus = await Promise.all(pagesRevoquees.map((p) => p.text()));
  check("LEG-02", "Liens révoqués : plus d'accès au dossier", contenus.every((t) => !t.includes(`${M}${enfantN}`) && !/Autorisation parentale 1/.test(t)), r.result);

  // ---------- LEG-05 : anonymisation ----------
  const D = iso(debut);
  sql(`insert into journees(projet_id,date) values('${P}','${D}') on conflict do nothing;`);
  let bookingRefuse = "";
  try { sql(`insert into bookings(figurant_id,projet_id,date,statut,cachet) values('${enfantId}','${P}','${D}','confirmé','Figurant');`); } catch (e) { bookingRefuse = String(e.stderr || e.message); }
  check("LEG-02", "Booking d'un mineur refusé tant que le dossier est incomplet (autorisation 2 et pièce requise manquantes)", /Dossier mineur incomplet/.test(bookingRefuse), bookingRefuse.slice(0, 80));
  sql(`insert into figurant_messages(figurant_id,projet_id,sender,categorie,corps) values('${enfantId}','${P}','staff','libre','Message ${M}');`);
  const fichiers = sql(`select count(*) from figurant_photos where figurant_id='${enfantId}';`);
  const chemins = sql(`select string_agg(storage_path, ',') from figurant_photos where figurant_id='${enfantId}';`).split(",").filter(Boolean);
  await staff.goto(BASE + "/rgpd");
  r = await call(staff, "/rgpd", "src/lib/rgpd/actions.ts", "anonymiserFigurant", [enfantId]);
  check("LEG-05", "Anonymisation par la propriétaire réussie", /"success":true/.test(r.result), r.result);
  const restes = sql(`select (select count(*) from figurants where id='${enfantId}' and (lower(coalesce(email,'')) = '${enfant.email}' or nom = '${enfant.nom}'))
    + (select count(*) from minor_guardians where figurant_id='${enfantId}') + (select count(*) from figurant_messages where figurant_id='${enfantId}')
    + (select count(*) from figurant_comptes where figurant_id='${enfantId}') + (select count(*) from figurant_photos where figurant_id='${enfantId}')
    + (select count(*) from minor_documents d join minor_dossiers x on x.id=d.dossier_id where x.figurant_id='${enfantId}' and d.storage_path is not null);`);
  check("LEG-05", "Plus aucune donnée identifiante, représentant, message, compte, photo ni pièce", restes === "0", `photos avant: ${fichiers}, restes: ${restes}`);
  let encore = 0;
  for (const ch of chemins) {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/figurant-photos/${ch}`, { headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY } });
    if (res.status === 200) encore += 1;
  }
  check("LEG-05", "Photos effacées du stockage", chemins.length >= 3 && encore === 0, `${chemins.length} fichiers, ${encore} encore présents`);
  const pAsst = await (await browser.newContext()).newPage();
  await pAsst.goto(BASE + "/login"); await pAsst.fill("input[type=email]", "assistante.test@test-chat-charge.fr"); await pAsst.fill("input[type=password]", "booking-test");
  await Promise.all([pAsst.waitForURL((u) => !u.pathname.startsWith("/login")), pAsst.locator("form button[type=submit]").first().click()]);
  await pAsst.goto(BASE + "/rgpd").catch(() => {});
  r = await call(pAsst, "/rgpd", "src/lib/rgpd/actions.ts", "anonymiserFigurant", [ado]);
  check("LEG-05", "Anonymisation refusée à une assistante", !/"success":true/.test(r.result) && sql(`select count(*) from figurants where id='${ado}' and nom like '${M}%';`) === "1", r.status);
} catch (e) {
  console.table(checks);
  throw e;
} finally {
  await browser.close();
  const ids = sql(`select string_agg(id::text, ',') from figurants where nom like '${M}%' or lower(email) like '${M.toLowerCase()}%';`).split(",").filter(Boolean);
  const chemins = ids.length ? sql(`select string_agg(storage_path, ',') from figurant_photos where figurant_id in (${ids.map((i) => `'${i}'`).join(",")});`).split(",").filter(Boolean) : [];
  if (chemins.length) await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/figurant-photos`, { method: "DELETE", headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: chemins }) });
  const docs = sql(`select string_agg(d.storage_path, ',') from minor_documents d join minor_dossiers x on x.id=d.dossier_id where x.projet_id='${P}' and d.storage_path is not null;`).split(",").filter(Boolean);
  if (docs.length) await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/minor-documents`, { method: "DELETE", headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: docs }) });
  sql(`delete from projets where id='${P}';`);
  if (ids.length) sql(`delete from figurants where id in (${ids.map((i) => `'${i}'`).join(",")});`);
  sql("delete from candidate_auth_attempts;");
}
console.table(checks);
assert.deepEqual(checks.filter((c) => !c.ok).map((c) => `${c.carte} ${c.nom}`), [], "Contrôles LEG en échec");
console.log(`PASS: LEG ${checks.length} contrôles (âge, représentants, dossier DRIEETS, dépôt, partage, anonymisation).`);
