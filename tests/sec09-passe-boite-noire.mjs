// SEC-09 — passe de sécurité en boîte noire (02/11/2026), rejouable : ce qu'un visiteur anonyme ou une assistante
// restreinte (sans « Base Profils ») obtient en attaquant directement l'API de la base et l'application locales.
// Base et application locales uniquement, données fictives créées puis supprimées.
// Usage : node tests/sec09-passe-boite-noire.mjs   (appli sur :3000)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const DB = process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS";
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || "playwright");
const chromium = (await import("./lib/navigateur.mjs")).navigateur(pw, process.env.BROWSER || "chromium");
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.equal(env.BOOKING_TEST_MODE, "1"); assert.match(env.NEXT_PUBLIC_SUPABASE_URL, /^http:\/\/(127\.0\.0\.1|localhost)/);
const API = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const psqlBrut = (q) => execFileSync("docker", ["exec", "-i", DB, "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }).trim();
const one = (q) => psqlBrut(`set request.jwt.claim.role='service_role';\n${q}`).split("\n").filter(Boolean).pop();
const results = [];
const check = (nom, ok, detail = "") => { results.push({ nom, ok }); console.log(`${ok ? "OK " : "KO "} ${nom}${detail ? " — " + detail : ""}`); };

const T = "SEC09-" + Date.now();
const P = one(`insert into projets(nom, owner_id) values('${T}','00000000-0000-4000-8000-00000000c0c0') returning id;`);
const X = one(`insert into figurants(prenom,nom,email,telephone,date_naissance,adresse,ville,acces_compte,confirme)
  values('Base','${T}','${T.toLowerCase()}@example.test','0611223344','1990-01-01','1 rue Fictive','Paris',true,true) returning id;`);
one(`insert into figurant_messages(figurant_id,sender,corps) values('${X}','figurant','${T} message privé') returning id;`);
const admin = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const email = `${T.toLowerCase()}-assistante@example.test`, password = "booking-test-sec09";
const u = await fetch(`${API}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password, email_confirm: true }) }).then((r) => r.json());
one(`update profiles set role='assistant', is_owner=false, nom='Assistante SEC09', sections_autorisees=array['/projets','/bookings'] where id='${u.id}';
     insert into projet_membres(projet_id, profile_id) values('${P}','${u.id}') returning id;`);

const tables = psqlBrut("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and relkind in ('r','v') order by 1;").split("\n").filter(Boolean);
const avecFigurant = psqlBrut("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid where n.nspname='public' and c.relkind='r' and a.attname='figurant_id' and not a.attisdropped order by 1;").split("\n").filter(Boolean);

const b = await chromium.launch();
try {
  // 1. Anonyme : aucune table lisible ni modifiable.
  const lisibles = [];
  for (const t of tables) {
    const r = await fetch(`${API}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
    const corps = r.ok ? await r.json() : null;
    if (r.ok && Array.isArray(corps) && corps.length) lisibles.push(t);
  }
  check(`Anonyme : aucune des ${tables.length} tables ne renvoie de ligne`, lisibles.length === 0, lisibles.join(", "));
  const ecrit = await fetch(`${API}/rest/v1/figurants`, { method: "POST", headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ prenom: "Intrus", nom: T }) });
  check("Anonyme : écriture refusée", ecrit.status >= 400 && one(`select count(*) from figurants where prenom='Intrus' and nom='${T}';`) === "0", `HTTP ${ecrit.status}`);
  const buckets = await fetch(`${API}/storage/v1/bucket`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } }).then((r) => r.json()).catch(() => []);
  check("Anonyme : liste des espaces de stockage vide", !Array.isArray(buckets) || buckets.length === 0);

  // 2. Assistante restreinte, avec le jeton de sa session dans l'application.
  const ctx = await b.newContext(); const page = await ctx.newPage();
  await page.goto(BASE + "/login"); await page.fill("input[type=email]", email); await page.fill("input[type=password]", password);
  await Promise.all([page.waitForURL((x) => !x.pathname.startsWith("/login"), { timeout: 20000 }), page.locator("form button[type=submit]").first().click()]);
  const brut = (await ctx.cookies()).filter((k) => /^sb-.*-auth-token(\.\d+)?$/.test(k.name)).sort((a, z) => a.name.localeCompare(z.name)).map((k) => decodeURIComponent(k.value)).join("");
  const jeton = JSON.parse(brut.startsWith("base64-") ? Buffer.from(brut.slice(7), "base64url").toString() : brut).access_token;
  const H = { apikey: ANON, Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" };
  const fuites = [];
  for (const t of ["figurants", ...avecFigurant]) {
    const col = t === "figurants" ? "id" : "figurant_id";
    const r = await fetch(`${API}/rest/v1/${t}?select=*&${col}=eq.${X}`, { headers: H });
    if (r.ok && (await r.json()).length) fuites.push(t);
  }
  check("Assistante restreinte : rien de la personne de la base, dans aucune table liée", fuites.length === 0, fuites.join(", "));
  const moi = await fetch(`${API}/rest/v1/profiles?id=eq.${u.id}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ role: "chef", is_owner: true, sections_autorisees: null }) });
  check("Assistante : pas d'auto-élévation de droits", one(`select role||is_owner::text||coalesce(array_to_string(sections_autorisees,','),'null') from profiles where id='${u.id}';`) === "assistantfalse/projets,/bookings", `HTTP ${moi.status}`);
  const page403 = await page.goto(`${BASE}/figurants/${X}`);
  check("Assistante restreinte : l'écran Base Profils reste fermé", !new URL(page.url()).pathname.startsWith("/figurants") || !(await page.content()).includes(T), `HTTP ${page403?.status()}`);

  // 3. Application : redirection ouverte, origine étrangère, CSP sur les erreurs, cookies.
  const redir = await fetch(`${BASE}/login?next=${encodeURIComponent("//exemple-malveillant.test")}`, { redirect: "manual" });
  const pageRedir = await b.newPage();
  await pageRedir.goto(`${BASE}/login?next=${encodeURIComponent("https://exemple-malveillant.test/")}`);
  await pageRedir.fill("input[type=email]", email); await pageRedir.fill("input[type=password]", password);
  await Promise.all([pageRedir.waitForURL((x) => !x.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {}), pageRedir.locator("form button[type=submit]").first().click()]);
  check("Pas de redirection ouverte après connexion", new URL(pageRedir.url()).host === new URL(BASE).host, pageRedir.url());
  await pageRedir.close();
  const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
  const [actionId] = Object.entries(manifest).find(([, v]) => v.exportedName === "createBookingFromDrop");
  const csrf = await fetch(`${BASE}/bookings`, { method: "POST", headers: { "Next-Action": actionId, Origin: "https://exemple-malveillant.test", Cookie: (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; "), "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify([X, P, "2030-01-01", null, "Passant", ""]) });
  check("Action serveur refusée depuis une origine étrangère", csrf.status >= 400 && one(`select count(*) from bookings where figurant_id='${X}';`) === "0", `HTTP ${csrf.status} ${redir.status}`);
  const introuvable = await fetch(`${BASE}/page-qui-n-existe-pas-${T}`);
  check("CSP présente sur une page d'erreur 404", /script-src [^;]*'nonce-/.test(introuvable.headers.get("content-security-policy") || ""), `HTTP ${introuvable.status}`);
  const cookies = await ctx.cookies();
  const session = cookies.find((c) => c.name === "session_started_at");
  check("Cookie de durée de session : httpOnly, SameSite=Lax", !session || (session.httpOnly && session.sameSite === "Lax"));
  await ctx.close();

  // 4. Aucun secret serveur dans les fichiers envoyés au navigateur.
  const secrets = [env.SUPABASE_SERVICE_ROLE_KEY, env.SECRETS_ENCRYPTION_KEY, env.AUTH_RATE_LIMIT_SECRET].filter((s) => s && s.length > 15);
  const fichiers = []; const parcourir = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); statSync(f).isDirectory() ? parcourir(f) : fichiers.push(f); } };
  parcourir(".next/static");
  const fuitesSecrets = fichiers.filter((f) => { const c = readFileSync(f, "latin1"); return secrets.some((s) => c.includes(s)) || /service_role|SUPABASE_SERVICE_ROLE_KEY|SECRETS_ENCRYPTION_KEY/.test(c); });
  check(`Aucun secret serveur dans les ${fichiers.length} fichiers publics`, fuitesSecrets.length === 0, fuitesSecrets.slice(0, 3).join(", "));
} finally {
  await b.close();
  psqlBrut(`delete from projets where id='${P}'; delete from figurant_messages where corps like '${T}%'; delete from figurants where nom like '${T}%';`);
  await fetch(`${API}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: admin });
}
const ko = results.filter((x) => !x.ok);
console.log(`\n${results.length - ko.length}/${results.length} contrôles OK`);
process.exit(ko.length ? 1 : 0);
