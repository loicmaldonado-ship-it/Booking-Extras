// BUG-09 / SEC-01 / SEC-02 / SEC-07 : authentification candidate et équipe, de bout en bout sur l'appli réelle.
// Appli et base LOCALES (BOOKING_TEST_MODE=1), données fictives. Usage : node tests/auth-e2e-local.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || "playwright");
const NAV = process.env.BROWSER || "chromium"; // chromium | webkit (moteur de Safari) | firefox
const chromium = (await import("./lib/navigateur.mjs")).navigateur(pw, NAV);
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.equal(env.BOOKING_TEST_MODE, "1");
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: `set request.jwt.claim.role='service_role';\n${q}`, encoding: "utf8" }).trim();
const one = (q) => sql(q).split("\n").filter(Boolean).pop();
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const action = (file, name) => { const [id, v] = Object.entries(manifest).find(([, x]) => x.filename === file && x.exportedName === name); const w = Object.keys(v.workers).find((k) => k.endsWith("/page") && !k.includes("[")) || Object.keys(v.workers)[0]; return { id, url: BASE + (w.replace(/^app/, "").replace(/\/page$/, "") || "/") }; };
async function call(page, file, name, args, form) {
  const a = action(file, name);
  return page.evaluate(async ({ a, args, form }) => {
    let body, headers = { "Next-Action": a.id, Accept: "text/x-component" };
    if (form) { const fd = new FormData(); for (const [k, v] of Object.entries(form)) { if (v && typeof v === "object" && v.__file) { const bin = Uint8Array.from(atob(v.__file), (c) => c.charCodeAt(0)); fd.append(`_1_${k}`, new File([bin], v.name, { type: v.type })); } else fd.append(`_1_${k}`, v); } fd.append("0", JSON.stringify(args.map((x) => (x === "$FORM" ? "$K1" : x)))); body = fd; }
    else { body = JSON.stringify(args); headers["Content-Type"] = "text/plain;charset=UTF-8"; }
    const r = await fetch(a.url, { method: "POST", headers, body, redirect: "manual" });
    const t = await r.text(); return { status: r.status, result: (t.split("\n").find((l) => l.startsWith("1:")) || "").slice(2) };
  }, { a, args, form });
}
const C = "src/lib/candidats/actions.ts";
// /compte rend 200 même sans session (redirection dans le flux, chargement progressif) : on juge sur le contenu.
const voitEspaceA = async (page) => (await (await page.request.get(BASE + "/compte")).text()).includes("Candidate-Test");
const checks = [];
const sharp = require("sharp");
const jpeg = (await sharp({ create: { width: 900, height: 1200, channels: 3, background: { r: 180, g: 140, b: 120 } } }).jpeg().toBuffer()).toString("base64");
const photo = (n) => ({ __file: jpeg, name: `${n}.jpg`, type: "image/jpeg" });
const check = (name, ok, detail = "") => { checks.push({ name, ok: !!ok, detail: String(detail).slice(0, 140) }); };

// ---- Fixtures : candidate A (seed) et candidate B (même hash de mot de passe que le seed) ----
const A = { id: "00000000-0000-4000-8000-00000000f001", email: "candidate.test@test-figurant.fr", tel: "0600000003" };
const stamp = Date.now();
const B = { email: `cand-b-${stamp}@example.test` };
B.id = one(`insert into figurants(prenom,nom,email,telephone,date_naissance,acces_compte) values('Bea','AuthB${stamp}','${B.email}','0611${String(stamp).slice(-6)}','1991-01-01',true) returning id;`);
sql(`insert into figurant_comptes(figurant_id,password_hash) select '${B.id}', password_hash from figurant_comptes where figurant_id='${A.id}';`);
const bMsg = one(`insert into figurant_messages(figurant_id,sender,corps,categorie) values('${B.id}','staff','msg B','libre') returning id;`);
const bPhoto = one(`insert into figurant_photos(figurant_id,type,storage_path) values('${B.id}','portrait','${B.id}/p.jpg') returning id;`);
sql(`insert into figurant_indisponibilites(figurant_id,date) values('${B.id}', current_date+50);`);
const bDate = one("select (current_date+50)::text;");
const resetLimiter = () => sql("delete from candidate_auth_attempts;");
resetLimiter();

const browser = await chromium.launch();
try {
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(BASE + "/compte/connexion");

  // BUG-09 : énumération
  const mlExist = await call(anon, C, "requestMagicLink", [null, "$FORM"], { email: A.email });
  const mlNone = await call(anon, C, "requestMagicLink", [null, "$FORM"], { email: `absent-${stamp}@example.test` });
  check("Lien magique : même réponse compte existant / absent", mlExist.result.replace(A.email, "X") === mlNone.result.replace(`absent-${stamp}@example.test`, "X"), mlExist.result + " | " + mlNone.result);
  const pwExist = await call(anon, C, "loginWithPassword", [null, "$FORM"], { email: B.email, password: "mauvais-mdp" });
  const pwNone = await call(anon, C, "loginWithPassword", [null, "$FORM"], { email: `absent2-${stamp}@example.test`, password: "mauvais-mdp" });
  check("Mot de passe faux : même message compte existant / absent", pwExist.result === pwNone.result, pwExist.result + " | " + pwNone.result);
  // BUG-09 : limitation
  resetLimiter();
  let limited = null;
  for (let i = 1; i <= 15 && !limited; i++) { const r = await call(anon, C, "loginWithPassword", [null, "$FORM"], { email: B.email, password: "faux-" + i }); if (!/incorrect/i.test(r.result)) limited = i; }
  check("Limitation après tentatives répétées", limited, `bloqué à la tentative ${limited}`);
  const goodWhileLimited = await call(anon, C, "loginWithPassword", [null, "$FORM"], { email: B.email, password: "booking-test" });
  const cookiesAfter = (await anon.context().cookies()).filter((c) => c.name === "figurant_session");
  check("Bon mot de passe refusé pendant le blocage, aucune session", cookiesAfter.length === 0, goodWhileLimited.result);
  resetLimiter();

  // SEC-01 : connaître email + téléphone ne suffit pas
  const ann = one(`insert into annonces(projet_id,titre,statut) values('00000000-0000-4000-8000-0000000070e0','Annonce auth ${stamp}','ouverte') returning public_token;`);
  const before = one(`select count(*) from candidatures where figurant_id='${A.id}';`);
  const post = await call(anon, "src/lib/candidatures/actions.ts", "postulerAnnonce", [ann, null, "$FORM"], { email: A.email, telephone: A.tel, prenom: "Sacha", nom: "Candidate-Test", ville: "Paris", adresse: "1 rue Fictive", code_postal: "75001", date_naissance: "1990-01-01", commune_naissance: "Paris", genre: "Femme", pronom: "Elle", message: "Bonjour", taille_cm: "170", poids_kg: "60", pointure: "40", veste: "M", pantalon: "38", selfie_date: new Date().toISOString().slice(0, 10), a_vehicule: "non", sans_agent: "on", password: "motdepasse-fictif-123", password_confirmation: "motdepasse-fictif-123", photo_portrait: photo("portrait"), photo_pied: photo("pied"), photo_selfie: photo("selfie") });
  check("Email + téléphone connus : pas de session ni de candidature (renvoi vers la connexion)", /compte/i.test(post.result) && (await anon.context().cookies()).every((c) => c.name !== "figurant_session") && one(`select count(*) from candidatures where figurant_id='${A.id}';`) === before, post.result);

  // SEC-02 : connexion réelle de A
  const pa = await (await browser.newContext()).newPage();
  await pa.goto(BASE + "/compte/connexion");
  const login = await call(pa, C, "loginWithPassword", [null, "$FORM"], { email: A.email, password: "booking-test" });
  const cookieA = (await pa.context().cookies()).find((c) => c.name === "figurant_session");
  check("Connexion candidate A", cookieA, login.result);
  const compte = await pa.request.get(BASE + "/compte", { maxRedirects: 0 });
  check("Espace /compte accessible à A", compte.status() === 200 && (await voitEspaceA(pa)), compte.status());

  // SEC-01 : A ne peut pas agir sur les données de B
  await pa.goto(BASE + "/compte");
  await call(pa, C, "markMessageBienRecu", [bMsg]);
  await call(pa, C, "deleteMaPhoto", [bPhoto]);
  await call(pa, C, "removeIndisponibiliteSelf", [bDate]);
  check("A ne modifie ni message, ni photo, ni indisponibilité de B",
    one(`select bien_recu::text from figurant_messages where id='${bMsg}';`) === "false" && one(`select count(*) from figurant_photos where id='${bPhoto}';`) === "1" && one(`select count(*) from figurant_indisponibilites where figurant_id='${B.id}';`) === "1");
  check("L'espace de A ne montre rien de B", !(await (await pa.request.get(BASE + "/compte")).text()).includes(`AuthB${stamp}`));

  // SEC-02 / SEC-07 : cookie altéré, expiration, déconnexion
  const forged = await (await browser.newContext()).newPage();
  await forged.context().addCookies([{ ...cookieA, value: cookieA.value.slice(0, -4) + "abcd" }]);
  check("Cookie candidat altéré refusé", !(await voitEspaceA(forged)));
  sql(`update figurant_sessions set expires_at = now() - interval '1 minute' where token = '${cookieA.value}';`);
  check("Session candidate expirée refusée", !(await voitEspaceA(pa)));
  await pa.context().clearCookies(); await pa.goto(BASE + "/compte/connexion");
  await call(pa, C, "loginWithPassword", [null, "$FORM"], { email: A.email, password: "booking-test" });
  const cookieA2 = (await pa.context().cookies()).find((c) => c.name === "figurant_session");
  await pa.goto(BASE + "/compte");
  await call(pa, C, "logoutFigurant", []);
  const replay = await (await browser.newContext()).newPage();
  await replay.context().addCookies([cookieA2]);
  check("Cookie candidat rejoué après déconnexion refusé", !(await voitEspaceA(replay)) && one(`select count(*) from figurant_sessions where token='${cookieA2.value}';`) === "0");

  // SEC-02 : lien de connexion à usage unique et expirable
  const tok = `e2e${stamp}${Math.random().toString(36).slice(2)}`;
  sql(`insert into figurant_auth_tokens(figurant_id,token,expires_at,objet) values('${A.id}','${tok}',now()+interval '15 minutes','connexion');`);
  const ml = await (await browser.newContext()).newPage();
  await ml.goto(BASE + `/compte/verifier?token=${tok}`);
  check("Lien de connexion valide ouvre l'espace", (await ml.context().cookies()).some((c) => c.name === "figurant_session"), ml.url());
  // SEC-02 : récupération — connectée par lien, A définit un nouveau mot de passe ; l'ancien ne fonctionne plus.
  const hashA = one(`select password_hash from figurant_comptes where figurant_id='${A.id}';`);
  await ml.goto(BASE + "/compte");
  await ml.fill("input[name=password]", "nouveau-mdp-fictif-42");
  await ml.fill("input[name=password_confirmation]", "nouveau-mdp-fictif-42");
  await ml.getByRole("button", { name: "Changer mon mot de passe" }).click();
  const setPw = { result: await ml.getByRole("status").filter({ hasText: "Mot de passe modifié" }).textContent({ timeout: 15000 }).catch((e) => "échec : " + e.message) };
  resetLimiter();
  const np = await (await browser.newContext()).newPage(); await np.goto(BASE + "/compte/connexion");
  await call(np, C, "loginWithPassword", [null, "$FORM"], { email: A.email, password: "nouveau-mdp-fictif-42" });
  const op = await (await browser.newContext()).newPage(); await op.goto(BASE + "/compte/connexion");
  await call(op, C, "loginWithPassword", [null, "$FORM"], { email: A.email, password: "booking-test" });
  check("Récupération : nouveau mot de passe accepté, ancien refusé",
    (await np.context().cookies()).some((c) => c.name === "figurant_session") && !(await op.context().cookies()).some((c) => c.name === "figurant_session"), setPw.result);
  sql(`update figurant_comptes set password_hash='${hashA}' where figurant_id='${A.id}';`);
  resetLimiter();
  const ml2 = await (await browser.newContext()).newPage();
  await ml2.goto(BASE + `/compte/verifier?token=${tok}`);
  check("Lien de connexion réutilisé refusé", !(await ml2.context().cookies()).some((c) => c.name === "figurant_session"), ml2.url());
  const tokOld = tok + "x";
  sql(`insert into figurant_auth_tokens(figurant_id,token,expires_at,objet) values('${A.id}','${tokOld}',now()-interval '1 minute','connexion');`);
  const ml3 = await (await browser.newContext()).newPage();
  await ml3.goto(BASE + `/compte/verifier?token=${tokOld}`);
  check("Lien de connexion expiré refusé", !(await ml3.context().cookies()).some((c) => c.name === "figurant_session"), ml3.url());

  // SEC-07 : équipe — déconnexion et session révoquée
  const st = await (await browser.newContext()).newPage();
  await st.goto(BASE + "/login"); await st.fill("input[type=email]", "assistante.test@test-chat-charge.fr"); await st.fill("input[type=password]", "booking-test");
  await Promise.all([st.waitForURL((u) => !u.pathname.startsWith("/login")), st.locator("form button[type=submit]").first().click()]);
  const staffCookies = await st.context().cookies();
  check("Session équipe ouverte", (await st.request.get(BASE + "/projets", { maxRedirects: 0 })).status() === 200);
  sql("delete from auth.sessions where user_id='00000000-0000-4000-8000-00000000a551';");
  const rRevoked = await st.request.get(BASE + "/projets", { maxRedirects: 0 });
  check("Session équipe révoquée : page protégée refusée", rRevoked.status() >= 300 && rRevoked.status() < 400, rRevoked.status());
  await st.context().clearCookies();
  await st.goto(BASE + "/login"); await st.fill("input[type=email]", "assistante.test@test-chat-charge.fr"); await st.fill("input[type=password]", "booking-test");
  await Promise.all([st.waitForURL((u) => !u.pathname.startsWith("/login")), st.locator("form button[type=submit]").first().click()]);
  // Expiration par durée (1 h, contrôlée en base par staff_session_is_current) : session vieillie de 2 h.
  sql("update auth.sessions set created_at = now() - interval '2 hours' where user_id='00000000-0000-4000-8000-00000000a551';");
  const rOld = await st.request.get(BASE + "/projets", { maxRedirects: 0 });
  check("Session équipe de plus d'1 h : page protégée refusée", rOld.status() >= 300 && rOld.status() < 400, rOld.status());
  await st.context().clearCookies();
  await st.goto(BASE + "/login"); await st.fill("input[type=email]", "assistante.test@test-chat-charge.fr"); await st.fill("input[type=password]", "booking-test");
  await Promise.all([st.waitForURL((u) => !u.pathname.startsWith("/login")), st.locator("form button[type=submit]").first().click()]);
  const live = await st.context().cookies();
  await call(st, "src/lib/auth/actions.ts", "signOut", []);
  const rp = await (await browser.newContext()).newPage();
  await rp.context().addCookies(live);
  const rAfterLogout = await rp.request.get(BASE + "/projets", { maxRedirects: 0 });
  check("Cookies équipe rejoués après déconnexion refusés", rAfterLogout.status() >= 300 && rAfterLogout.status() < 400, rAfterLogout.status());
  void staffCookies;
} finally {
  await browser.close();
  resetLimiter();
  sql(`delete from annonces where titre='Annonce auth ${stamp}'; delete from figurants where id='${B.id}'; delete from figurant_auth_tokens where figurant_id='${A.id}' and token like 'e2e%';`);
}
console.table(checks);
const failed = checks.filter((c) => !c.ok);
assert.deepEqual(failed.map((c) => c.name), [], "Contrôles d'authentification en échec");
console.log(`PASS: ${checks.length} contrôles d'authentification candidate et équipe.`);
