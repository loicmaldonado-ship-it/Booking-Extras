// QA-08 (30/10/2026) : une erreur serveur et une erreur navigateur contrôlées apparaissent dans le journal de l'appli
// (« [booking-error] » JSON : environnement, release, route, type, pile exploitable) et les secrets placés volontairement
// dans ces erreurs n'y apparaissent pas. Lit le journal de `npm start` (NEXT_LOG, défaut /tmp/next.log).
// Usage : NEXT_LOG=/chemin/next.log node tests/qa08-journal-erreurs.mjs
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const LOG = process.env.NEXT_LOG || "/tmp/next.log";
const NAV = process.env.BROWSER || "chromium"; // chromium | webkit (moteur de Safari) | firefox
const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
const chromium = (await import("./lib/navigateur.mjs")).navigateur(pw, NAV);
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const lignes = () => readFileSync(LOG, "utf8").split("\n").filter((l) => l.includes("[booking-error] ")).map((l) => JSON.parse(l.slice(l.indexOf("[booking-error] ") + 16)));
const avant = lignes().length;
let url = "";
const SECRET = "Sup3rS3cretQa08-" + Date.now();

const browser = await chromium.launch();
try {
  const page = await (await browser.newContext()).newPage();
  // 1. Erreur serveur : action qui lève une exception (ligne de barème inexistante), appelée avec un « mot de passe » dans l'argument.
  await page.goto(BASE + "/login");
  await page.fill("input[type=email]", "cheffe.test@test-chat-charge.fr"); await page.fill("input[type=password]", "booking-test");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.locator("form button[type=submit]").first().click()]);
  const [id, entree] = Object.entries(manifest).find(([, v]) => v.filename === "src/lib/bareme/actions.ts" && v.exportedName === "deleteBaremeCachet");
  const worker = Object.keys(entree.workers).find((k) => k.endsWith("/page") && !k.includes("[")) || Object.keys(entree.workers)[0];
  url = worker.replace(/^app/, "").replace(/\/page$/, "") || "/";
  await page.goto(BASE + url);
  await page.evaluate(async ({ id, SECRET, url }) => {
    await fetch(url, { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component", "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify([`password=${SECRET}`]) });
  }, { id, SECRET, url });
  // 2. Erreur navigateur non gérée, message contenant un secret, un email et un jeton.
  await page.goto(BASE + "/confidentialite?token=" + SECRET);
  await page.evaluate((SECRET) => { setTimeout(() => { throw new Error(`Erreur test QA-08 token=${SECRET} pour lou@example.fr`); }, 0); }, SECRET);
  await page.waitForTimeout(2500);
} finally {
  await browser.close();
}
const nouvelles = lignes().slice(avant);
const serveur = nouvelles.find((r) => r.source === "serveur" && r.routeType === "action");
const client = nouvelles.find((r) => r.source === "navigateur" && /Erreur test QA-08/.test(r.message));
console.log(JSON.stringify({ serveur, client }, null, 1).slice(0, 1500));
assert.ok(serveur, "erreur serveur absente du journal");
assert.ok(serveur.pile.includes("at ") && serveur.release && serveur.env && serveur.route === url, "contexte serveur incomplet");
assert.ok(client, "erreur navigateur absente du journal");
assert.ok(client.route === "/confidentialite" && client.navigateur && client.pile, "contexte navigateur incomplet");
const brut = readFileSync(LOG, "utf8").split("\n").filter((l) => l.includes("[booking-error] ")).join("\n");
assert.ok(!brut.includes(SECRET) && !brut.includes("lou@example.fr"), "un secret de test apparaît dans le journal");
console.log(`PASS: QA-08 ${nouvelles.length} erreur(s) journalisée(s), aucun secret de test dans le journal.`);
