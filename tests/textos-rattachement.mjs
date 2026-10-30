// Revue indépendante du 30/10/2026 (S1) : une personne d'une équipe pouvait rattacher ses textos à un projet et un
// profil d'une AUTRE équipe (identifiants envoyés par le navigateur), et ses réponses SMS arrivaient alors dans la
// messagerie de l'autre équipe. Vérifie que les rattachements étrangers sont ignorés et que les légitimes sont gardés.
// Usage : node tests/textos-rattachement.mjs   (appli sur :3000, base locale avec seed)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const NAV = process.env.BROWSER || "chromium";
const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
const navigateur = (await import("./lib/navigateur.mjs")).navigateur(pw, NAV);
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: `set request.jwt.claim.role='service_role';\n${q}`, encoding: "utf8" }).trim().split("\n").filter(Boolean).pop() ?? "";
const admin = (path, method, body) => fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/${path}`, { method, headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) }).then((r) => r.json());
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const [id, entree] = Object.entries(manifest).find(([, v]) => v.filename === "src/lib/textos/actions.ts" && v.exportedName === "noterTextosEnvoyesIphone");
const worker = Object.keys(entree.workers).find((k) => k.endsWith("/page") && !k.includes("[")) || Object.keys(entree.workers)[0];
const url = worker.replace(/^app/, "").replace(/\/page$/, "") || "/";

const M = "Txt" + Date.now().toString(36);
const P = "00000000-0000-4000-8000-0000000070e0";
const D = sql("select (current_date+88)::text;");
const fig = sql(`insert into figurants(prenom,nom,email,date_naissance) values('Lou','${M}','${M.toLowerCase()}@example.test','1990-01-01') returning id;`);
sql(`insert into journees(projet_id,date) values('${P}','${D}') on conflict do nothing; insert into bookings(figurant_id,projet_id,date,statut,cachet) values('${fig}','${P}','${D}','confirmé','Figurant');`);
const autre = await admin("users", "POST", { email: `txt-autre-${Date.now()}@example.test`, password: "booking-test-x", email_confirm: true });
sql(`update profiles set role='chef', is_owner=false, acces_complet=true where id='${autre.id}';`);
const checks = [];
const browser = await navigateur.launch();
try {
  const appel = async (email, password, tel) => {
    const p = await (await browser.newContext()).newPage();
    await p.goto(BASE + "/login"); await p.fill("input[type=email]", email); await p.fill("input[type=password]", password);
    await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login")), p.locator("form button[type=submit]").first().click()]);
    await p.goto(BASE + url);
    await p.evaluate(async ({ id, url, args }) => { await fetch(url, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(args) }); },
      { id, url, args: [[{ nom: "Lou", telephone: tel, texte: `Texte ${M}`, figurantId: fig, projetId: P }]] });
    await p.context().close();
    return sql(`select coalesce(figurant_id::text,'null')||'/'||coalesce(projet_id::text,'null') from textos_file where telephone like '%${tel.slice(-6)}' order by created_at desc limit 1;`);
  };
  const etranger = await appel(autre.email, "booking-test-x", "0611000001");
  checks.push({ nom: "Cheffe d'une autre équipe : rattachement au projet et au profil ignoré", ok: etranger === "null/null", detail: etranger });
  const legitime = await appel("cheffe.test@test-chat-charge.fr", "booking-test", "0611000002");
  checks.push({ nom: "Cheffe du projet, profil booké : rattachement conservé", ok: legitime === `${fig}/${P}`, detail: legitime });
} finally {
  await browser.close();
  await admin(`users/${autre.id}`, "DELETE");
  sql(`delete from textos_file where message='Texte ${M}'; delete from bookings where figurant_id='${fig}'; delete from figurants where id='${fig}';`);
}
console.table(checks);
assert.deepEqual(checks.filter((c) => !c.ok).map((c) => c.nom), [], "Rattachement des textos incorrect");
console.log("PASS: textos rattachés seulement aux projets accessibles et profils liés.");
