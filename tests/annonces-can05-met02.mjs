// CAN-05 / MET-02 (30/10/2026) : options d'annonce vérifiées côté serveur sur la vraie action de candidature, plus QR
// code et affiche. Annonce fictive avec 2 questions, 2 dates, bande démo obligatoire, cachet « Rôle » (agent demandé) et
// limite de 2 candidatures. Usage : node tests/annonces-can05-met02.mjs   (appli sur :3000, base locale avec seed)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const NAV = process.env.BROWSER || "chromium";
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || "playwright");
const sharp = require("sharp");
const QRCode = require("qrcode");
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.equal(env.BOOKING_TEST_MODE, "1");
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: `set request.jwt.claim.role='service_role';\n${q}`, encoding: "utf8" }).trim().split("\n").filter(Boolean).pop() ?? "";
const adminApi = (path, method, body) => fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/${path}`, { method, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const [ACTION] = Object.entries(manifest).find(([, v]) => v.filename === "src/lib/candidatures/actions.ts" && v.exportedName === "postulerAnnonce");
const jpeg = (await sharp({ create: { width: 900, height: 1200, channels: 3, background: "#8090a0" } }).jpeg().toBuffer()).toString("base64");

const M = "Ann" + Date.now().toString(36);
const P = "00000000-0000-4000-8000-0000000070e0";
const annId = sql(`insert into annonces(projet_id,titre,statut,bande_demo_obligatoire,types_cachet,limite_candidatures) values('${P}','Annonce ${M}','ouverte',true,'{Rôle}',2) returning id;`);
const tok = sql(`select public_token from annonces where id='${annId}';`);
const q1 = sql(`insert into annonce_questions(annonce_id,label,ordre) values('${annId}','Vélo ?',0) returning id;`);
const q2 = sql(`insert into annonce_questions(annonce_id,label,ordre) values('${annId}','Permis ?',1) returning id;`);
const d1 = sql(`insert into annonce_dates(annonce_id,date) values('${annId}',current_date+40) returning id;`);
const d2 = sql(`insert into annonce_dates(annonce_id,date) values('${annId}',current_date+41) returning id;`);
const autre = await adminApi("users", "POST", { email: `ann-autre-${Date.now()}@example.test`, password: "booking-test-x", email_confirm: true });
sql(`update profiles set role='chef', is_owner=false, acces_complet=true where id='${autre.id}';`);

let n = 0;
const base = () => { n += 1; return { prenom: "Cand", nom: `${M}${n}`, email: `${M.toLowerCase()}-${n}@example.test`, telephone: `0656${String(Date.now() + n).slice(-6)}`, ville: "Paris",
  adresse: "1 rue Fictive", code_postal: "75001", date_naissance: "1990-05-05", commune_naissance: "Paris", genre: "Homme", pronom: "Il", message: "Bonjour", taille_cm: "180",
  poids_kg: "75", pointure: "43", veste: "L", pantalon: "42", selfie_date: new Date().toISOString().slice(0, 10), a_vehicule: "non", password: "motdepasse-fictif-123",
  password_confirmation: "motdepasse-fictif-123" }; };
const complet = (over = {}) => ({ ...base(), [`question_${q1}`]: "oui", [`question_${q2}`]: "non", [`date_${d1}`]: "oui", [`date_${d2}`]: "non",
  lien_bande_demo: "https://example.test/demo", sans_agent: "on", ...over });
const checks = [];
const check = (carte, nom, ok, detail = "") => checks.push({ carte, nom, ok: !!ok, detail: String(detail).slice(0, 110) });

const browser = await (await import("./lib/navigateur.mjs")).navigateur(pw, NAV).launch();
try {
  const postuler = async (champs, retirer = []) => {
    const page = await (await browser.newContext()).newPage();
    await page.goto(`${BASE}/postuler/${tok}`);
    const r = await page.evaluate(async ({ id, tok, champs, retirer, jpeg }) => {
      const bin = Uint8Array.from(atob(jpeg), (c) => c.charCodeAt(0));
      const fd = new FormData();
      for (const [k, v] of Object.entries(champs)) if (!retirer.includes(k)) fd.append(`_1_${k}`, v);
      for (const p of ["photo_portrait", "photo_pied", "photo_selfie"]) fd.append(`_1_${p}`, new File([bin], `${p}.jpg`, { type: "image/jpeg" }));
      fd.append("0", JSON.stringify([tok, null, "$K1"]));
      const res = await fetch(`/postuler/${tok}`, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component" }, body: fd });
      return ((await res.text()).split("\n").find((l) => l.startsWith("1:")) || "").slice(2, 300);
    }, { id: ACTION, tok, champs, retirer, jpeg });
    await page.context().close();
    return r;
  };
  const nb = () => sql(`select count(*) from candidatures where annonce_id='${annId}';`);

  // ---------- CAN-05 : champs obligatoires selon l'annonce (contrôle serveur, formulaire contourné) ----------
  let c = complet();
  let r = await postuler(c, [`question_${q2}`]);
  check("CAN-05", "Question sans réponse : refus", /toutes les questions/.test(r) && nb() === "0", r);
  c = complet(); r = await postuler(c, [`date_${d2}`]);
  check("CAN-05", "Disponibilité non indiquée pour une date : refus", /chaque disponibilité/.test(r) && nb() === "0", r);
  c = complet(); r = await postuler(c, ["lien_bande_demo"]);
  check("CAN-05", "Bande démo obligatoire absente : refus", /bande démo est obligatoire/.test(r) && nb() === "0", r);
  c = complet(); r = await postuler(c, ["sans_agent"]);
  check("CAN-05", "Cachet « Rôle » sans agent ni « pas d'agent » coché : refus", /agent/.test(r) && nb() === "0", r);
  c = complet(); r = await postuler(c, [], );
  const cand1 = sql(`select c.id from candidatures c join figurants f on f.id=c.figurant_id where c.annonce_id='${annId}' and lower(f.email)='${c.email}';`);
  check("CAN-05", "Candidature complète acceptée", /"success":true/.test(r) && cand1, r);
  check("CAN-05", "Réponses aux 2 questions et 2 disponibilités enregistrées", cand1 && sql(`select (select count(*) from candidature_reponses where candidature_id='${cand1}')||'/'||(select count(*) from candidature_disponibilites where candidature_id='${cand1}');`) === "2/2");
  check("CAN-05", "Lien de bande démo enregistré sur la fiche", sql(`select count(*) from figurant_liens l join figurants f on f.id=l.figurant_id where lower(f.email)='${c.email}' and l.url='https://example.test/demo';`) === "1");
  c = complet({ [`question_${q1}`]: "peut-être" }); r = await postuler(c);
  check("CAN-05", "Réponse falsifiée (ni oui ni non) : refus", /toutes les questions/.test(r), r);

  // ---------- MET-02 : limite de candidatures et fermeture ----------
  r = await postuler(complet());
  check("MET-02", "2e candidature acceptée (limite 2)", /"success":true/.test(r) && nb() === "2", r);
  r = await postuler(complet());
  check("MET-02", "3e candidature refusée : limite atteinte", /nombre maximum/.test(r) && nb() === "2", r);
  sql(`update annonces set limite_candidatures=null, statut='fermée' where id='${annId}';`);
  r = await postuler(complet());
  check("MET-02", "Annonce fermée : candidature refusée même avec un formulaire déjà ouvert", /n'accepte plus/.test(r) && nb() === "2", r);
  sql(`update annonces set statut='ouverte' where id='${annId}';`);

  // ---------- MET-02 : QR code et affiche ----------
  const staff = async (email, password) => {
    const p = await (await browser.newContext()).newPage();
    await p.goto(BASE + "/login"); await p.fill("input[type=email]", email); await p.fill("input[type=password]", password);
    await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login")), p.locator("form button[type=submit]").first().click()]);
    return p;
  };
  const cheffe = await staff("cheffe.test@test-chat-charge.fr", "booking-test");
  await cheffe.goto(`${BASE}/annonces/${annId}`);
  const src = await cheffe.locator('img[alt="QR code vers l\'annonce"]').getAttribute("src");
  const attendu = await QRCode.toDataURL(`${BASE.replace(/\/$/, "")}/postuler/${tok}`, { errorCorrectionLevel: "M", margin: 1, width: 512 });
  check("MET-02", "QR code de l'annonce = lien public de candidature de CETTE annonce", src === attendu, src ? `${src.length} car.` : "absent");
  for (const format of ["", "?format=story"]) {
    const res = await cheffe.request.get(`${BASE}/annonces/${annId}/poster${format}`);
    const corps = await res.body();
    check("MET-02", `Affiche ${format ? "story" : "standard"} générée (image PNG)`, res.status() === 200 && /image\/png/.test(res.headers()["content-type"] || "") && corps.length > 10_000, `${res.status()} ${corps.length} o`);
  }
  const intrus = await staff(autre.email, "booking-test-x");
  const resIntrus = await intrus.request.get(`${BASE}/annonces/${annId}/poster`, { maxRedirects: 0 });
  check("MET-02", "Affiche refusée à une cheffe d'une autre équipe", resIntrus.status() !== 200 || !/image/.test(resIntrus.headers()["content-type"] || ""), resIntrus.status());
} finally {
  await browser.close();
  await adminApi(`users/${autre.id}`, "DELETE");
  const ids = sql(`select string_agg(id::text, ',') from figurants where nom like '${M}%';`).split(",").filter(Boolean);
  const chemins = ids.length ? sql(`select string_agg(storage_path, ',') from figurant_photos where figurant_id in (${ids.map((i) => `'${i}'`).join(",")});`).split(",").filter(Boolean) : [];
  if (chemins.length) await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/figurant-photos`, { method: "DELETE", headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: chemins }) });
  sql(`delete from annonces where id='${annId}';`);
  if (ids.length) sql(`delete from figurants where id in (${ids.map((i) => `'${i}'`).join(",")});`);
  sql("delete from candidate_auth_attempts;");
}
console.table(checks);
assert.deepEqual(checks.filter((c) => !c.ok).map((c) => `${c.carte} ${c.nom}`), [], "Contrôles annonce en échec");
console.log(`PASS: ${checks.length} contrôles d'annonce (champs obligatoires, limite, fermeture, QR, affiche) sur ${NAV}.`);
