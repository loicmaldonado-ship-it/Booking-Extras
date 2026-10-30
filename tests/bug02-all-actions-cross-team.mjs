// BUG-02 : appel DIRECT de TOUTES les Server Actions admin par une cheffe d'une AUTRE équipe.
// Base et application LOCALES uniquement (BOOKING_TEST_MODE=1), données fictives, aucun envoi externe.
// Pré-requis : `npm run build && npm start` (port 3000), Supabase local avec seed.
// Usage : node tests/bug02-all-actions-cross-team.mjs [--json sortie.json]
//
// Méthode : un projet fictif A (cheffe du seed) est rempli d'une ressource par type. Une cheffe B
// (non propriétaire globale) est créée. Pour chaque action listée dans
// docs/bug02-inventaire-actions-2026-10-30.json, les paramètres sont remplis à partir de leur nom avec les
// identifiants de A (formulaires compris : champs extraits du code source). Après CHAQUE appel, une
// empreinte de toutes les tables publiques est comparée à la précédente : toute table modifiée est
// attribuée à l'action. Le projet A et la cheffe B sont supprimés à la fin (suppression en cascade).
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const DB = process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const ACTOR = process.env.ACTOR || "cheffe-autre-equipe"; // ou "assistante-hors-projet"
assert.ok(["cheffe-autre-equipe", "assistante-hors-projet", "cheffe-proprietaire"].includes(ACTOR), "ACTOR inconnu");
const LEGIT = ACTOR === "cheffe-proprietaire"; // la cheffe propriétaire du projet A appelle tout sur SES données : aucune action ne doit planter
const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : null;

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.equal(env.BOOKING_TEST_MODE, "1", "BOOKING_TEST_MODE=1 requis");
assert.match(env.NEXT_PUBLIC_SUPABASE_URL, /127\.0\.0\.1|localhost/, "Base locale uniquement");

const psql = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8", maxBuffer: 64 << 20 }).trim();
const svc = (q) => psql(`set request.jwt.claim.role='service_role';\n${q}`);
const one = (q) => svc(q).split("\n").filter(Boolean).pop();
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const inventory = JSON.parse(readFileSync("docs/bug02-inventaire-actions-2026-10-30.json", "utf8"));

const SEED_CHEF = "00000000-0000-4000-8000-00000000c0c0";
const SEED_ASSIST = "00000000-0000-4000-8000-00000000a551";
// L'assistante du seed est membre du projet A : en mode LEGIT la cheffe de test peut légitimement modifier ses accès.
// Son état est sauvegardé ici et restauré à la fin pour ne pas polluer les autres tests (bug08, auth-e2e).
const SEED_ASSIST_ETAT = execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt"],
  { input: `select json_build_object('acces_complet', acces_complet, 'sections', sections_autorisees, 'role', role)::text from profiles where id='${SEED_ASSIST}';`, encoding: "utf8" }).trim();
let FIG = "00000000-0000-4000-8000-00000000f001"; // remplacé ci-dessous par un profil PRIVÉ à l'équipe A
const TAG = "BUG02ALL-" + Date.now();
const RANDOM = "00000000-0000-4000-8000-0000000b0b0b";

// ---------- Fixtures équipe A ----------
const A = {};
A.projet = one(`insert into projets(nom, owner_id) values('${TAG} projet A','${SEED_CHEF}') returning id;`);
const P = A.projet;
FIG = one(`insert into figurants(prenom,nom,date_naissance,email,temporaire_projet_id,est_comedien,comedien_pool_id,acces_compte) values('Privee','${TAG}','1990-01-01','${TAG.toLowerCase()}@example.test','${P}',true,'${SEED_CHEF}',true) returning id;`);
svc(`insert into figurant_comptes(figurant_id,password_hash) values('${FIG}','fixture-only');`);
A.membre = one(`insert into projet_membres(projet_id, profile_id) values('${P}','${SEED_ASSIST}') returning id;`);
A.annonce = one(`insert into annonces(projet_id,titre,statut) values('${P}','${TAG} annonce','fermée') returning id;`); // fermée : une annonce ouverte (titre, projet, cheffe) est publique par conception sur l'accueil
A.date = one(`select (current_date+70)::text;`);
A.annDate = one(`insert into annonce_dates(annonce_id,date) values('${A.annonce}','${A.date}') returning id;`);
A.question = one(`insert into annonce_questions(annonce_id,label) values('${A.annonce}','${TAG}') returning id;`);
A.annPhoto = one(`insert into annonce_photos(annonce_id,storage_path) values('${A.annonce}','${TAG}/p.jpg') returning id;`);
A.cand = one(`insert into candidatures(figurant_id,annonce_id) values('${FIG}','${A.annonce}') returning id;`);
svc(`insert into candidature_jours(candidature_id,annonce_date_id) values('${A.cand}','${A.annDate}');`);
A.onglet = one(`insert into candidature_onglets(nom,annonce_id) values('${TAG}','${A.annonce}') returning id;`);
A.etiq = one(`insert into candidature_etiquettes(projet_id,nom) values('${P}','${TAG}') returning id;`);
A.journee = one(`insert into journees(projet_id,date) values('${P}','${A.date}') returning id;`);
A.besoin = one(`insert into journee_besoins(journee_id,fonction,quantite) values('${A.journee}','${TAG}',2) returning id;`);
A.booking = one(`insert into bookings(figurant_id,projet_id,date,notes,candidature_id) values('${FIG}','${P}','${A.date}','${TAG}','${A.cand}') returning id;`);
A.reserve = one(`insert into reserve_profils(projet_id,figurant_id) values('${P}','${FIG}') returning id;`);
A.role = one(`insert into casting_roles(projet_id,nom) values('${P}','${TAG}') returning id;`);
A.entry = one(`insert into casting_entries(projet_id,figurant_id,role_id,notes) values('${P}','${FIG}','${A.role}','${TAG}') returning id;`);
A.pJournee = one(`insert into casting_presentiel_journees(projet_id,date) values('${P}','${A.date}') returning id;`);
A.pCreneau = one(`insert into casting_presentiel_creneaux(journee_id,heure_debut,heure_fin) values('${A.pJournee}','10:00','11:00') returning id;`);
A.pEntry = one(`insert into casting_presentiel_entries(projet_id,journee_id,creneau_id,figurant_id) values('${P}','${A.pJournee}','${A.pCreneau}','${FIG}') returning id;`);
A.eJournee = one(`insert into essayage_journees(projet_id,date) values('${P}','${A.date}') returning id;`);
A.eCreneau = one(`insert into essayage_creneaux(essayage_journee_id,heure_debut,heure_fin) values('${A.eJournee}','10:00','11:00') returning id;`);
A.essayage = one(`insert into essayages(figurant_id,projet_id,essayage_journee_id) values('${FIG}','${P}','${A.eJournee}') returning id;`);
A.eLieu = one(`insert into essayage_lieux(projet_id,nom) values('${P}','${TAG}') returning id;`);
A.partage = one(`insert into partage_liens(projet_id,type,token) values('${P}','documents','${TAG}-tok') returning id;`);
A.partageJ = one(`insert into partage_journee_liens(projet_id,date,token) values('${P}','${A.date}','${TAG}-tokj') returning id;`);
A.lienVal = one(`insert into liens_validation(projet_id,nom,source,token) values('${P}','${TAG}','bookings','${TAG}-tokv') returning id;`);
A.indemnite = one(`insert into projet_indemnites(projet_id,label,montant) values('${P}','${TAG}',10) returning id;`);
A.fonction = one(`insert into projet_fonctions(projet_id,nom) values('${P}','${TAG}-fct') returning id;`);
A.envoi = one(`insert into envois(projet_id,titre,corps,canal) values('${P}','${TAG}','x','email') returning id;`);
A.dest = one(`insert into envoi_destinataires(envoi_id,figurant_id,booking_id) values('${A.envoi}','${FIG}','${A.booking}') returning id;`);
A.fmsg = one(`insert into figurant_messages(figurant_id,sender,corps,projet_id,booking_id,categorie) values('${FIG}','figurant','${TAG}','${P}','${A.booking}','booking') returning id;`);
A.template = one(`insert into message_templates(nom,sujet,corps,equipe_id) values('${TAG}','s','c','${SEED_CHEF}') returning id;`);
// Répertoire d'agents et références de l'accueil : communs à tous par conception (marqueur distinct de TAG).
A.agent = one(`insert into agents(nom) values('BUG02GLOBAL-${Date.now()}') returning id;`);
A.reference = one(`insert into references_accueil(titre) values('BUG02GLOBAL-${Date.now()}') returning id;`);
A.baremeCachet = one(`select id from bareme_cachets order by id limit 1;`);
A.baremeMaj = one(`select id from bareme_majorations order by id limit 1;`);
A.dossier = one(`insert into minor_dossiers(projet_id,figurant_id) values('${P}','${FIG}') returning id;`);

// Barème commun : sauvegardé puis restauré en fin d'exécution (le test peut le modifier, c'est ce qu'il mesure).
const BAREME = ["bareme_cachets", "bareme_majorations"];
const baremeBackup = Object.fromEntries(BAREME.map((t) => [t, svc(`select coalesce(json_agg(b),'[]') from ${t} b;`)]));
const restoreBareme = () => {
  for (const t of BAREME) {
    const cols = psql(`select string_agg(quote_ident(column_name), ',') from information_schema.columns where table_schema='public' and table_name='${t}';`);
    const set = cols.split(",").filter((c) => c !== "id").map((c) => `${c}=excluded.${c}`).join(",");
    svc(`insert into ${t}(${cols}) select ${cols} from json_populate_recordset(null::${t}, $json$${baremeBackup[t]}$json$) on conflict (id) do update set ${set};
         delete from ${t} where id not in (select id from json_populate_recordset(null::${t}, $json$${baremeBackup[t]}$json$));`);
  }
};

// ---------- Cheffe B ----------
const B_EMAIL = `cheffe-b-${Date.now()}@example.test`, B_PASS = "booking-test-b";
const created = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, {
  method: "POST", headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ email: B_EMAIL, password: B_PASS, email_confirm: true }),
}).then((r) => r.json());
assert.ok(created.id, "Création cheffe B impossible");
const B = created.id;
if (ACTOR !== "assistante-hors-projet") svc(`update profiles set role='chef', is_owner=false, nom='Cheffe B fictive' where id='${B}';`);
if (LEGIT) svc(`update projets set owner_id='${B}' where id='${P}'; update message_templates set equipe_id='${B}' where id='${A.template}'; update figurants set comedien_pool_id='${B}' where id='${FIG}';`);
else svc(`update profiles set role='assistant', is_owner=false, acces_complet=true, sections_autorisees=null, nom='Assistante B fictive' where id='${B}';`);
const PB = ACTOR === "cheffe-autre-equipe" ? one(`insert into projets(nom, owner_id) values('Projet B ${Date.now()}','${B}') returning id;`) : RANDOM;

// ---------- Paramètres ----------
const fileOf = (f) => f.replace(/^src\/lib\//, "");
const idByFile = (f) => {
  const m = [["agents/", A.agent], ["annonces/dates", A.annDate], ["annonces/moodboard", A.annPhoto], ["annonces/questions", A.question], ["annonces/", A.annonce],
    ["bookings/besoins", A.besoin], ["bookings/", A.booking], ["candidatures/etiquettes", A.etiq], ["candidatures/", A.cand], ["casting-presentiel/", A.pEntry],
    ["casting/", A.entry], ["essayages/", A.essayage], ["figurants/", FIG], ["indemnites/", A.indemnite], ["references/", A.reference], ["templates/", A.template],
    ["equipe/", A.membre], ["validation/", A.lienVal], ["partage/", A.partage], ["messages/", A.envoi], ["minors/", A.dossier], ["fonctions", A.fonction], ["bareme/", A.baremeCachet], ["projets/", P]];
  return (m.find(([k]) => fileOf(f).startsWith(k)) || [null, A.cand])[1];
};
const S = "INTRUSION-B";
function valueFor(name, type, file) {
  const n = name.replace(/\?$/, "");
  const f = fileOf(file);
  const map = {
    projetId: P, project: P, figurantId: FIG, figurantIds: [FIG], annonceId: A.annonce, journeeId: A.journee, essayageJourneeId: A.eJournee,
    roleId: A.role, ids: [A.booking], bookingIds: [A.booking], bookingId: A.booking, candidatureIds: [A.cand], candidatureId: A.cand,
    annonceDateId: A.annDate, reserveIds: [A.reserve], projetMembreId: A.membre, profileId: SEED_ASSIST, chefId: SEED_CHEF, etiquetteId: A.etiq,
    ongletId: A.onglet, projetIndemniteId: A.indemnite, envoiId: A.envoi, destinataireId: A.dest, destinataireIds: [A.dest], messageId: A.fmsg,
    messageIds: [A.fmsg], messageRowId: A.fmsg, dossierId: A.dossier, documentId: RANDOM, lienId: f.startsWith("validation") ? A.lienVal : A.partage,
    essayageId: A.essayage, entryIds: [f.startsWith("casting-presentiel") ? A.pEntry : A.entry], profilId: FIG, photoIds: [A.annPhoto], baremeMajorationId: A.baremeMaj,
    entryId: f.startsWith("casting-presentiel") ? A.pEntry : A.entry, creneauId: f.startsWith("essayages") ? A.eCreneau : A.pCreneau,
    photoId: f.startsWith("annonces") ? A.annPhoto : RANDOM, path: `projets/${P}/x.mp4`, sections: [], cachet: "Figurant", type: "documents", categorie: null,
    statut: f.startsWith("annonces") ? "fermée" : f.startsWith("essayages") ? "fait" : "confirmé", mode: "selftape",
    changes: { notes: S, statut: "confirmé" }, options: { avecProfils: true, repasserEnPer: false }, cible: { projetId: P },
    agent: { nom: S }, params: { projetId: P, date: A.date, titre: S, sujet: S, corps: S, canal: "email", avecAccuse: false, destinataires: [{ figurantId: FIG, bookingId: A.booking }] },
    items: [{ destinataireId: A.dest, figurantId: FIG, bookingId: A.booking, email: "intrus@example.test", sujet: S, corps: S }],
    rows: [{ bookingId: A.booking, figurantId: FIG, email: "intrus@example.test", corps: S, subject: S }],
    destinataires: [{ figurantId: FIG, bookingId: A.booking }], candidatureIdByFigurant: { [FIG]: A.cand }, dates: [A.date], opts: { bookingId: A.booking, candidatureId: A.cand },
    cle: "avis", doc: "fiches_roles", sens: "haut", kind: "photo", relance: false,
  };
  if (n in map) return map[n];
  if (/^(id)$/.test(n)) return idByFile(file);
  if (/date|Date|debut|fin$/.test(n)) return A.date;
  if (/^boolean/.test(type) || /^(visible|value|actif|pose|prevu|recu|masquer|valeur|parEmail|repasserEnPer|renommerBookings|showContacts|reponse_recue)$/.test(n)) return true;
  if (/^number/.test(type) || /^(position|quantite|montant|montantBrut)$/.test(n)) return 7;
  if (/\[\]/.test(type)) return [];
  if (/^\{/.test(type) || /Record</.test(type)) return {};
  return S;
}
function formFieldValue(field, file) {
  const k = field.toLowerCase();
  if (k === "id") return idByFile(file);
  if (k.includes("projet")) return P;
  if (k.includes("figurant")) return FIG;
  if (k.includes("annonce_date")) return A.annDate;
  if (k.includes("annonce")) return A.annonce;
  if (k.includes("essayage_journee")) return A.eJournee;
  if (k.includes("journee")) return A.journee;
  if (k.includes("booking")) return A.booking;
  if (k.includes("candidature")) return A.cand;
  if (k.includes("role")) return A.role;
  if (k.includes("entry")) return A.entry;
  if (k.includes("creneau")) return A.eCreneau;
  if (k.includes("dossier")) return A.dossier;
  if (k.includes("date") || k.includes("debut") || k.includes("fin")) return A.date;
  if (k.includes("email")) return "intrus@example.test";
  if (k.includes("cachet")) return "Figurant";
  if (k.includes("statut")) return "confirmé";
  if (/montant|quantite|capacite|valeur|ordre|annee|limite/.test(k)) return "7";
  return S;
}

// ---------- Construction des appels ----------
const SKIP = new Set(["signOut", "logoutFigurant", "quitterModeSupport", "clearCurrentProjet", "setCurrentProjet"]);
const LAST = new Set(["entrerModeSupport", "revokeChefAccess"]); // pourraient changer la session : en fin de série
const splitParams = (s) => { const out = []; let d = 0, cur = ""; for (const ch of s) { if ("<{[(".includes(ch)) d++; if (">}])".includes(ch)) d--; if (ch === "," && d === 0) { out.push(cur); cur = ""; } else cur += ch; } if (cur.trim()) out.push(cur); return out.map((p) => p.replace(/\/\/.*$/gm, "").trim()).filter(Boolean); };
const calls = [];
for (const r of inventory) {
  if (SKIP.has(r.action)) continue;
  const src = readFileSync(r.file, "utf8");
  const m = src.match(new RegExp(`export async function ${r.action}\\s*\\(`));
  if (!m) continue;
  let i = m.index + m[0].length, d = 1, j = i; while (d > 0 && j < src.length) { if (src[j] === "(") d++; if (src[j] === ")") d--; j++; }
  const params = splitParams(src.slice(i, j - 1));
  const bodyStart = src.indexOf("{", j); const nextExport = src.indexOf("\nexport ", bodyStart); const body = src.slice(bodyStart, nextExport < 0 ? undefined : nextExport);
  const args = [], forms = [];
  for (const p of params) {
    const [rawName, ...typeParts] = p.split(":"); const name = rawName.replace(/\s*=.*$/, "").trim(); const type = typeParts.join(":").replace(/=.*$/, "").trim();
    if (/FormData/.test(type)) {
      const varName = name.replace(/\?$/, "");
      const fieldRx = (v) => new RegExp(`(?:\\w+\\(\\s*${v}\\s*,\\s*|${v}\\.(?:get|getAll|has)\\(\\s*)["'\`]([\\w-]+)["'\`]`, "g");
      const fields = [...new Set([...body.matchAll(fieldRx(varName)), ...src.matchAll(fieldRx("\\w+"))].map((x) => x[1]))];
      forms.push({ index: args.length, fields: Object.fromEntries(fields.map((f) => [f, formFieldValue(f, r.file)])) });
      args.push(null);
    } else if (/^_prev/.test(name)) args.push(null);
    else args.push(valueFor(name, type, r.file));
  }
  const entry = Object.entries(manifest).find(([, v]) => v.filename === r.file && v.exportedName === r.action);
  if (!entry) continue;
  const ws = Object.keys(entry[1].workers).filter((w) => w.endsWith("/page"));
  const worker = ((ws.find((w) => !w.includes("[")) || ws[0]) || "app/page").replace(/^app/, "").replace(/\/page$/, "").replace(/\[[^\]]+\]/g, A.annonce) || "/";
  calls.push({ file: r.file, action: r.action, id: entry[0], worker, args, forms });
}
if (process.env.ONLY) calls.splice(0, calls.length, ...calls.filter((c) => process.env.ONLY.split(",").includes(c.action)));
calls.sort((a, b) => Number(LAST.has(a.action)) - Number(LAST.has(b.action)));

// ---------- Empreinte de la base ----------
const tables = psql(`select tablename from pg_tables where schemaname='public' order by 1;`).split("\n").filter(Boolean);
const VOLATILE = ["last_seen_at", "updated_at", "derniere_vue"];
const snapQuery = "select " + tables.map((t) => `(select md5(coalesce(string_agg((to_jsonb(r) ${VOLATILE.map((c) => `- '${c}'`).join(" ")})::text, '|' order by (to_jsonb(r))::text), '')) from public.${t} r) as "${t}"`).join(", ") + ";";
const snapshot = () => { const vals = psql(`\\pset tuples_only on\n\\pset format unaligned\n\\pset fieldsep '\\t'\n${snapQuery}`).split("\n").pop().split("\t"); return Object.fromEntries(tables.map((t, k) => [t, vals[k]])); };

// Lignes qui n'appartiennent pas à la cheffe B, dans les tables où B peut légitimement écrire pour elle-même.
const othersQuery = () => psql(`select md5(coalesce((select string_agg((to_jsonb(r)-'last_seen_at'-'updated_at')::text,'|' order by r.id) from profiles r where id<>'${B}'),'')
  ||coalesce((select string_agg(to_jsonb(r)::text,'|' order by r.id) from message_templates r where equipe_id is distinct from '${B}'),'')
  ||coalesce((select string_agg(to_jsonb(r)::text,'|' order by r.profile_id,r.contexte) from derniers_messages r where profile_id<>'${B}'),'')
  ||coalesce((select string_agg(to_jsonb(r)::text,'|' order by r.profile_id) from relais_textos r where profile_id<>'${B}'),'')
  ||coalesce((select string_agg((to_jsonb(r)-'updated_at')::text,'|' order by r.id) from bareme_cachets r where equipe_id is distinct from '${B}'),'')
  ||coalesce((select string_agg((to_jsonb(r)-'updated_at')::text,'|' order by r.id) from bareme_majorations r where equipe_id is distinct from '${B}'),''));`);
const othersBefore = othersQuery();
// Actions qui n'écrivent que pour la personne connectée (profil, brouillons, modèles de son équipe, clé de relais)
// ou qui journalisent une tentative de connexion candidate (limiteur).
const BAREME_SELF = ["bareme_cachets", "bareme_majorations", "bareme_equipes"]; // copie du barème propre à l'équipe de B
const SELF_SCOPED = { "auth/email-actions.ts#updateMyGmailSmtp": ["profiles"],
  "bareme/actions.ts#updateBaremeCachet": BAREME_SELF, "bareme/actions.ts#deleteBaremeCachet": BAREME_SELF, "bareme/actions.ts#createBaremeCachet": BAREME_SELF,
  "bareme/actions.ts#updateBaremeMajoration": BAREME_SELF, "bareme/actions.ts#deleteBaremeMajoration": BAREME_SELF, "bareme/actions.ts#createBaremeMajoration": BAREME_SELF, "auth/email-actions.ts#updateMyEmailTemplates": ["profiles"],
  "auth/profile-actions.ts#updateMyProfile": ["profiles"], "messages/derniers-actions.ts#enregistrerDernierMessage": ["derniers_messages"],
  "templates/actions.ts#createTemplate": ["message_templates"], "textos/actions.ts#genererCleRelais": ["relais_textos"],
  "candidats/actions.ts#requestMagicLink": ["candidate_auth_attempts"], "candidats/actions.ts#loginWithPassword": ["candidate_auth_attempts"] };

// ---------- Exécution ----------
const browser = await chromium.launch();
const results = [];
try {
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/login");
  await page.fill("input[type=email]", B_EMAIL); await page.fill("input[type=password]", B_PASS);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }), page.locator("form button[type=submit]").first().click()]);
  let before = snapshot();
  for (const c of calls) {
    const r = await page.evaluate(async ({ url, id, args, forms, tag }) => {
      let body, headers = { "Next-Action": id, Accept: "text/x-component" };
      if (forms.length) {
        const fd = new FormData(); const root = [...args];
        forms.forEach((f, k) => { const key = k + 1; root[f.index] = "$K" + key.toString(16); for (const [n, v] of Object.entries(f.fields)) fd.append(`_${key}_${n}`, v); });
        fd.append("0", JSON.stringify(root)); body = fd;
      } else { body = JSON.stringify(args); headers["Content-Type"] = "text/plain;charset=UTF-8"; }
      try { const res = await fetch(url, { method: "POST", headers, body, redirect: "manual" }); const t = await res.text(); return { status: res.status, line1: (t.split("\n").find((l) => l.startsWith("1:")) || "").slice(0, 200), full: t.length, tagLeak: t.includes(tag), tagCtx: t.includes(tag) ? t.slice(Math.max(0, t.indexOf(tag) - 900), t.indexOf(tag) + 200) : "" }; }
      catch (e) { return { status: "ERR", line1: String(e).slice(0, 200) }; }
    }, { url: BASE + c.worker, id: c.id, args: c.args, forms: c.forms, tag: TAG });
    const after = snapshot();
    const changed = tables.filter((t) => before[t] !== after[t]);
    before = after;
    results.push({ action: `${fileOf(c.file)}#${c.action}`, http: r.status, changed, reponse: r.line1, leak: Boolean(r.tagLeak), tagCtx: r.tagCtx || "" });
  }
} finally {
  await browser.close();
  var othersAfter = othersQuery();
  restoreBareme();
  svc(`update profiles p set acces_complet=(e->>'acces_complet')::boolean, role=e->>'role',
         sections_autorisees=case when e->'sections' = 'null'::jsonb then null else array(select jsonb_array_elements_text(e->'sections')) end
       from (select $json$${SEED_ASSIST_ETAT}$json$::jsonb as e) x where p.id='${SEED_ASSIST}';`);
  svc(`delete from projets where id in ('${P}','${PB}'); delete from figurants where nom like 'BUG02ALL-%'; delete from message_templates where id='${A.template}'; delete from agents where nom like 'BUG02ALL-%' or nom like 'BUG02GLOBAL-%' or id='${A.agent}'; delete from references_accueil where titre like 'BUG02ALL-%' or titre like 'BUG02GLOBAL-%';`);
  await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${B}`, { method: "DELETE", headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } });
}

if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 1));
const suspects = results.filter((r) => r.changed.length || r.leak);
console.log(`[${ACTOR}] ${results.length} actions appelées ; ${suspects.length} ont modifié au moins une table ou renvoyé un token :`);
for (const s of suspects) console.log(` - ${s.action} [${s.http}] tables: ${s.changed.join(", ") || "-"}${s.leak ? " FUITE-LECTURE" : ""} :: ${s.reponse.slice(0, 120)}${s.leak ? "\n     contexte: " + s.tagCtx.replace(/\s+/g, " ") : ""}`);
if (LEGIT) {
  const crashes = results.filter((r) => r.http === 500 || /^E\{/.test(r.reponse));
  console.log(`[cheffe-proprietaire] ${results.length} actions ; ${crashes.length} plantages serveur :`);
  for (const c of crashes) console.log("  PLANTAGE " + c.action + " :: " + c.reponse.slice(0, 100));
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 1));
  process.exit(0);
}
const unexpected = suspects.filter((r) => (r.leak || r.changed.some((t) => !(SELF_SCOPED[r.action] || []).includes(t))));
assert.equal(othersAfter, othersBefore, "Des lignes n'appartenant pas à la cheffe B ont été modifiées (profils, modèles, brouillons ou relais d'autres personnes)");
assert.deepEqual(unexpected.map((r) => r.action), [], "Actions ayant modifié des données hors du périmètre de la cheffe B");
assert.ok(results.length >= 240, `Trop peu d'actions appelées : ${results.length}`);
console.log(`PASS [${ACTOR}]: ${results.length} actions appelées directement ; seules les données de la personne connectée ont changé, aucune donnée de A renvoyée.`);
