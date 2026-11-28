// SEC-05 : liens publics par token — périmètre, tokens invalides / tronqués / d'un autre type, révocation, contacts.
// Appli et base LOCALES, données fictives, navigation SANS cookie. Usage : node tests/sec05-share-links.mjs
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: `set request.jwt.claim.role='service_role';\n${q}`, encoding: "utf8" }).trim();
const one = (q) => sql(q).split("\n").filter(Boolean).pop();
const get = async (path) => { const r = await fetch(BASE + path, { redirect: "manual" }); return { status: r.status, body: await r.text() }; };
const hex = () => crypto.randomUUID().replace(/-/g, "");

const M = "Sec05" + Date.now().toString(36);
const EMAIL = `${M.toLowerCase()}@example.test`, TEL = "0699" + String(Date.now()).slice(-6);
const P = one(`insert into projets(nom,owner_id) values('Projet ${M}','00000000-0000-4000-8000-00000000c0c0') returning id;`);
const D = one("select (current_date+40)::text;");
const fig = one(`insert into figurants(prenom,nom,email,telephone,date_naissance,acces_compte) values('Partage','${M}Fig','${EMAIL}','${TEL}','1990-01-01',true) returning id;`);
sql(`insert into figurant_comptes(figurant_id,password_hash) values('${fig}','fixture');`);
sql(`insert into journees(projet_id,date) values('${P}','${D}'); insert into bookings(figurant_id,projet_id,date,statut) values('${fig}','${P}','${D}','confirmé');`);
const ej = one(`insert into essayage_journees(projet_id,date) values('${P}','${D}') returning id;`);
sql(`insert into essayages(figurant_id,projet_id,essayage_journee_id,statut) values('${fig}','${P}','${ej}','confirmé');`);
const role = one(`insert into casting_roles(projet_id,nom,lien_public_actif) values('${P}','Role ${M}',true) returning id;`);
const rolePublic = one(`select public_token from casting_roles where id='${role}';`);
const entryReq = one(`insert into casting_entries(projet_id,figurant_id,role_id,visible_partage) values('${P}','${fig}','${role}',true) returning request_token;`);
const T = { documents: hex(), essayages: hex(), casting: hex(), journeeSans: hex(), journeeAvec: hex() };
sql(`insert into partage_liens(projet_id,type,token) values('${P}','documents','${T.documents}'),('${P}','essayages','${T.essayages}'),('${P}','casting','${T.casting}');
     insert into partage_journee_liens(projet_id,date,token,show_contacts) values('${P}','${D}','${T.journeeSans}',false);`);
const annonce = one(`insert into annonces(projet_id,titre,statut) values('${P}','Annonce ${M}','ouverte') returning public_token;`);
const dispo = one(`select token_disponibilite from figurants where id='${fig}';`);
const envoi = one(`insert into envois(projet_id,titre,corps,canal) values('${P}','${M}','x','email') returning id;`);
const recu = one(`insert into envoi_destinataires(envoi_id,figurant_id) values('${envoi}','${fig}') returning token;`);

const routes = [
  ["documents", `/partage/documents/${T.documents}`, T.documents],
  ["documents-fiches", `/partage/documents/${T.documents}/fiches?date=${D}`, T.documents],
  ["essayages", `/partage/essayages/${T.essayages}`, T.essayages],
  ["essayages-planning", `/partage/essayages/${T.essayages}/planning?date=${D}`, T.essayages],
  ["casting", `/partage/casting/${T.casting}`, T.casting],
  ["journee", `/partage/documents/${T.journeeSans}`, T.journeeSans],
  ["postuler", `/postuler/${annonce}`, annonce],
  ["casting-rejoindre", `/casting/rejoindre/${rolePublic}`, rolePublic],
  ["casting-upload", `/casting/upload/${entryReq}`, entryReq],
  ["disponibilites", `/disponibilites/${dispo}`, dispo],
  ["recu", `/recu/${recu}`, recu],
];
const results = [];
const leaksData = (body) => body.includes(M);
try {
  for (const [kind, path, token] of routes) {
    const ok = await get(path);
    const random = await get(path.replace(token, kind === "postuler" || kind.startsWith("casting-") || kind === "disponibilites" || kind === "recu" ? crypto.randomUUID() : hex()));
    const truncated = await get(path.replace(token, token.slice(0, -4)));
    results.push({ kind, valide: ok.status + (leaksData(ok.body) ? " données" : ok.status === 200 && ok.body.length !== random.body.length ? " données (sans nom)" : " ?"), inexistant: random.status + (leaksData(random.body) ? " FUITE" : ""), tronque: truncated.status + (leaksData(truncated.body) ? " FUITE" : "") });
  }
  // Token d'un autre type
  const cross = [[`/partage/essayages/${T.documents}`], [`/partage/casting/${T.essayages}`], [`/partage/documents/${T.casting}`], [`/partage/validation/${T.documents}`]];
  for (const [path] of cross) { const r = await get(path); results.push({ kind: "autre-type " + path.split("/")[2], valide: "-", inexistant: r.status + (leaksData(r.body) ? " FUITE" : ""), tronque: "-" }); }
  // Contacts : journée « sans contacts » vs « avec contacts »
  const sans = (await get(`/partage/documents/${T.journeeSans}/fiches`)).body + (await get(`/partage/documents/${T.journeeSans}/trombis`)).body;
  sql(`insert into partage_journee_liens(projet_id,date,token,show_contacts) values('${P}','${D}','${T.journeeAvec}',true) on conflict do nothing;`);
  const sansContacts = !sans.includes(EMAIL) && !sans.includes(TEL);
  // Révocation : suppression du lien documents puis nouvelle visite
  sql(`delete from partage_liens where token='${T.documents}';`);
  const apres = await get(`/partage/documents/${T.documents}`);
  // Projet archivé : comportement observé (règle métier MET-01 : consultable par la cheffe ; liens publics à décider)
  sql(`update projets set archive=true where id='${P}';`);
  const archive = await get(`/partage/essayages/${T.essayages}`);
  console.table(results);
  console.log({ sansContacts, revoque: apres.status + (leaksData(apres.body) ? " ENCORE ACCESSIBLE" : " inaccessible"), projetArchive_lienEssayages: archive.status + (leaksData(archive.body) ? " accessible" : " inaccessible") });
  const fails = results.filter((r) => /FUITE/.test(r.inexistant + r.tronque) || (r.valide !== "-" && !r.valide.includes("données")));
  assert.deepEqual(fails, [], "Lien public défaillant : " + JSON.stringify(fails));
  assert.ok(sansContacts, "Emails/téléphones exposés par un lien de journée « sans contacts »");
  assert.ok(!leaksData(apres.body), "Lien révoqué encore accessible");
  console.log("PASS: chaque token n'ouvre que son périmètre ; inexistant, tronqué, autre type et révoqué refusés ; contacts masqués quand demandé.");
} finally {
  sql(`delete from envois where id='${envoi}'; delete from projets where id='${P}'; delete from figurants where id='${fig}';`);
}
