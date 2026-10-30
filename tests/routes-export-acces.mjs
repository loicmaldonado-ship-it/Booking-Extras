// Accès aux routes d'export (30/10/2026) : faille trouvée sur /bookings/export-myrole (aucun contrôle : une cheffe d'une
// autre équipe téléchargeait l'export Myrole complet d'un projet). Ce test appelle chaque route d'export/téléchargement
// avec : anonyme, cheffe d'une autre équipe, assistante membre du projet, cheffe propriétaire. Contenu vérifié (MET-08).
// Usage : node tests/routes-export-acces.mjs   (appli sur :3000, base locale avec seed)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const NAV = process.env.BROWSER || "chromium";
const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: `set request.jwt.claim.role='service_role';\n${q}`, encoding: "utf8" }).trim().split("\n").filter(Boolean).pop() ?? "";
const admin = (path, method, body) => fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/${path}`, { method, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());

const P = "00000000-0000-4000-8000-0000000070e0", ANN = "00000000-0000-4000-8000-00000000a000", FIG = "00000000-0000-4000-8000-00000000f001";
const D = sql("select (current_date+77)::text;");
const nomFig = sql(`select nom from figurants where id='${FIG}';`);
sql(`insert into journees(projet_id,date) values('${P}','${D}') on conflict do nothing;
     insert into bookings(figurant_id,projet_id,date,statut,cachet) values('${FIG}','${P}','${D}','confirmé','Figurant');`);
const role = sql(`insert into casting_roles(projet_id,nom) values('${P}','Role export') returning id;`);
sql(`insert into casting_entries(projet_id,role_id,figurant_id) values('${P}','${role}','${FIG}');`);
const autre = await admin("users", "POST", { email: `export-autre-${Date.now()}@example.test`, password: "booking-test-x", email_confirm: true });
sql(`update profiles set role='chef', is_owner=false, acces_complet=true where id='${autre.id}';`);

const routes = [
  { nom: "Export Myrole (CSV)", url: `/bookings/export-myrole?projet_id=${P}&date=${D}`, type: /text\/csv/, contient: nomFig, assistante: true },
  { nom: "vCards de la journée", url: `/bookings/documents/vcards?projet_id=${P}&date=${D}`, type: /text\/vcard/, contient: nomFig, assistante: true },
  { nom: "Liste artistique (export)", url: `/casting/liste-artistique/export?projet_id=${P}`, type: /spreadsheet|csv|octet/, contient: null, assistante: true },
  { nom: "Export bookings XLSX (propriétaire seule)", url: `/bookings/export?projet_id=${P}&date=${D}`, type: /spreadsheet|octet/, contient: null, assistante: false },
  { nom: "Export candidatures XLSX (propriétaire seule)", url: `/candidatures/export?annonce_id=${ANN}`, type: /spreadsheet|octet/, contient: null, assistante: false },
];
const lignes = [];
const browser = await (await import("./lib/navigateur.mjs")).navigateur(pw, NAV).launch();
try {
  const session = async (email, password) => {
    const p = await (await browser.newContext()).newPage();
    if (email) {
      await p.goto(BASE + "/login"); await p.fill("input[type=email]", email); await p.fill("input[type=password]", password);
      await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login")), p.locator("form button[type=submit]").first().click()]);
    }
    return p;
  };
  const acteurs = { anonyme: await session(), "cheffe autre équipe": await session(autre.email, "booking-test-x"),
    "assistante membre": await session("assistante.test@test-chat-charge.fr", "booking-test"), "cheffe propriétaire": await session("cheffe.test@test-chat-charge.fr", "booking-test") };
  for (const r of routes) for (const [qui, page] of Object.entries(acteurs)) {
    const res = await page.request.get(BASE + r.url, { maxRedirects: 0 });
    const corps = res.status() === 200 ? (await res.body()) : Buffer.alloc(0);
    const recu = res.status() === 200 && r.type.test(res.headers()["content-type"] || "");
    const attendu = qui === "cheffe propriétaire" || (qui === "assistante membre" && r.assistante);
    const fuite = !attendu && (recu || (nomFig && corps.toString("utf8").includes(nomFig)));
    const contenuOk = !attendu || (recu && (!r.contient || corps.toString("utf8").includes(r.contient)));
    lignes.push({ route: r.nom, qui, http: res.status(), fichier: recu, attendu: attendu ? "fichier" : "refus", ok: !fuite && contenuOk });
  }
} finally {
  await browser.close();
  await admin(`users/${autre.id}`, "DELETE");
  sql(`delete from casting_roles where id='${role}'; delete from bookings where projet_id='${P}' and date='${D}'; delete from journees where projet_id='${P}' and date='${D}';`);
}
console.table(lignes);
assert.deepEqual(lignes.filter((l) => !l.ok).map((l) => `${l.route} / ${l.qui} (${l.http})`), [], "Accès aux exports incorrect");
console.log(`PASS: ${routes.length} routes d'export × 4 acteurs : fichiers servis aux seules personnes autorisées, contenu présent.`);
