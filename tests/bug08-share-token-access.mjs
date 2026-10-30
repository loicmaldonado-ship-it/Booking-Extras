// BUG-08 : un token de partage ne se lit que par une personne autorisée sur le projet.
// Appli et base LOCALES. Usage : node tests/bug08-share-token-access.mjs
// Cas positifs ici (propriétaire, assistante membre du projet) et anonyme ; les cas « cheffe d'une autre équipe » et
// « assistante hors projet » sont couverts par tests/bug02-all-actions-cross-team.mjs (détection de lecture).
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const require = createRequire(import.meta.url);
const NAV = process.env.BROWSER || "chromium"; // chromium | webkit (moteur de Safari) | firefox
const pw = require(process.env.PLAYWRIGHT_PATH || "playwright");
const chromium = (await import("./lib/navigateur.mjs")).navigateur(pw, NAV);
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: `set request.jwt.claim.role='service_role';\n${q}`, encoding: "utf8" }).trim();
const P = "00000000-0000-4000-8000-0000000070e0"; // projet du seed (cheffe propriétaire + assistante membre)
const TOKEN = `bug08-${Date.now()}`;
const id = sql(`insert into partage_liens(projet_id,type,token) values('${P}','essayages','${TOKEN}') returning id;`).split("\n").pop();
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const [actionId, meta] = Object.entries(manifest).find(([, v]) => v.filename === "src/lib/partage/actions.ts" && v.exportedName === "getPartageToken");
const worker = Object.keys(meta.workers).find((w) => w.endsWith("/page") && !w.includes("[")).replace(/^app/, "").replace(/\/page$/, "");
const call = (page) => page.evaluate(async ({ url, id, P }) => {
  const r = await fetch(url, { method: "POST", headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component" }, body: JSON.stringify([P, "essayages", null]), redirect: "manual" });
  return { status: r.status, text: await r.text() };
}, { url: BASE + worker, id: actionId, P });

const browser = await chromium.launch();
const out = {};
try {
  for (const [who, email] of [["proprietaire", "cheffe.test@test-chat-charge.fr"], ["assistante-membre", "assistante.test@test-chat-charge.fr"]]) {
    const page = await (await browser.newContext()).newPage();
    await page.goto(BASE + "/login"); await page.fill("input[type=email]", email); await page.fill("input[type=password]", "booking-test");
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }), page.locator("form button[type=submit]").first().click()]);
    out[who] = (await call(page)).text.includes(TOKEN);
  }
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(BASE + "/login");
  out.anonyme = (await call(anon)).text.includes(TOKEN);
} finally {
  await browser.close();
  sql(`delete from partage_liens where id='${id}';`);
}
console.log(out);
assert.deepEqual(out, { proprietaire: true, "assistante-membre": true, anonyme: false });
console.log("PASS: token renvoyé à la propriétaire et à l'assistante membre, refusé sans session.");
