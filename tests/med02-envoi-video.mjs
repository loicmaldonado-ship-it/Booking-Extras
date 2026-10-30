// MED-02 / MED-03 (30/10/2026) : envoi d'un selftape sur le vrai lien de dépôt casting (/casting/upload/[token]),
// Chromium, réseau ralenti (≈ 4G lente) pour observer la progression. Vidéo réelle (WebM, image + son) générée dans le
// navigateur. Vérifie : progression croissante jusqu'à « envoyée », fichier stocké identique, annulation en cours
// d'envoi (interface, rien de rattaché à la fiche, fichier orphelin éventuel signalé). Safari/Firefox : appareils réels.
// Usage : node tests/med02-envoi-video.mjs   (appli sur :3000, base locale fictive, BOOKING_TEST_MODE=1)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const pw = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
const NAV = process.env.BROWSER || "chromium"; // chromium | webkit (moteur de Safari) | firefox
const chromium = (await import("./lib/navigateur.mjs")).navigateur(pw, NAV);
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.equal(env.BOOKING_TEST_MODE, "1");
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }).trim().split("\n").filter(Boolean).pop() ?? "";
const stockage = async (prefix) => (await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/list/casting-videos`, { method: "POST",
  headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ prefix, limit: 100 }) })).json());

const M = "Vid" + Date.now().toString(36);
const owner = sql("select id from profiles where email='cheffe.test@test-chat-charge.fr';");
const P = sql(`insert into projets(nom,owner_id) values('Projet ${M}','${owner}') returning id;`);
const fig = sql(`insert into figurants(prenom,nom,email,date_naissance) values('Lou','${M}','${M.toLowerCase()}@example.test','1990-01-01') returning id;`);
let n = 0; // une demande = un rôle (unicité rôle/figurante)
const nouvelleDemande = () => { const role = sql(`insert into casting_roles(projet_id,nom,nb_videos) values('${P}','Role ${M} ${++n}',1) returning id;`);
  return sql(`insert into casting_entries(projet_id,role_id,figurant_id) values('${P}','${role}','${fig}') returning request_token;`); };
const checks = [];
const check = (nom, ok, detail = "") => checks.push({ nom, ok: !!ok, detail: String(detail).slice(0, 120) });

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: NAV !== "firefox", hasTouch: true });
  const page = await ctx.newPage();
  // Vraie vidéo : 12 s, 1280×720, image animée + son, débit élevé (≈ 20 Mo), fabriquée avec Chromium (MediaRecorder) ;
  // l'envoi se fait ensuite dans le navigateur testé.
  const genBrowser = await (await import("./lib/navigateur.mjs")).navigateur(pw, "chromium").launch();
  const genPage = await genBrowser.newPage();
  await genPage.goto(BASE + "/confidentialite");
  const b64 = await genPage.evaluate(async () => {
    const c = document.createElement("canvas"); c.width = 1280; c.height = 720; const x = c.getContext("2d");
    const ac = new AudioContext(); const o = ac.createOscillator(); const dst = ac.createMediaStreamDestination(); o.connect(dst); o.start();
    const stream = new MediaStream([...c.captureStream(30).getVideoTracks(), ...dst.stream.getAudioTracks()]);
    const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus", videoBitsPerSecond: 16_000_000 });
    const parts = []; rec.ondataavailable = (e) => parts.push(e.data); rec.start(500);
    const t0 = performance.now();
    await new Promise((r) => { const f = () => { const t = performance.now() - t0; for (let i = 0; i < 400; i++) { x.fillStyle = `hsl(${(i * 13 + t / 5) % 360},80%,${30 + (i % 40)}%)`; x.fillRect((i * 997 + t) % 1280, (i * 613) % 720, 40, 40); } if (t < 12000) requestAnimationFrame(f); else r(); }; f(); });
    rec.stop(); await new Promise((r) => (rec.onstop = r)); o.stop();
    const blob = new Blob(parts, { type: "video/webm" });
    return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(blob); });
  });
  await genBrowser.close();
  const video = Buffer.from(b64, "base64");
  // Réseau lent : émulation Chromium (débit réel) ; ailleurs, la requête d'envoi vers le stockage est retenue quelques
  // secondes (pas de limitation de débit hors Chromium : la progression peut alors sauter directement à la fin).
  const cdp = NAV === "chromium" ? await ctx.newCDPSession(page) : null;
  let retenue = 0;
  if (cdp) await cdp.send("Network.enable");
  const cible = /\/storage\/v1\/object\/upload\/sign\//;
  const retenir = async (route) => { await new Promise((r) => setTimeout(r, retenue)); await route.continue().catch(() => {}); };
  const reseau = async (mode) => {
    // Hors Chromium, l'interception n'est active que pour le test d'annulation (elle ralentit fortement les gros envois).
    if (!cdp) { retenue = 9000; if (mode === "lent") await page.route(cible, retenir); else await page.unroute(cible).catch(() => {}); return; }
    const debit = { normal: [4_000_000, 24_000_000, 80], lent: [1_000_000, 2_000_000, 150], rapide: [-1, -1, 0] }[mode];
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: debit[2], downloadThroughput: debit[0] > 0 ? debit[0] / 8 : -1, uploadThroughput: debit[1] > 0 ? debit[1] / 8 : -1 });
  };
  await page.goto(BASE + "/confidentialite");
  await reseau("normal");

  // 1. Envoi complet
  const tok1 = nouvelleDemande();
  const entry1 = sql(`select id from casting_entries where request_token='${tok1}';`);
  await page.goto(`${BASE}/casting/upload/${tok1}`);
  const t0 = Date.now(); const vus = [];
  await page.locator('input[type=file][accept="video/*"]').first().setInputFiles({ name: "selftape.webm", mimeType: "video/webm", buffer: video });
  for (let i = 0; i < 600; i++) {
    const txt = await page.locator("text=/Envoi \\d+ %/").first().textContent({ timeout: 200 }).catch(() => null);
    if (txt) vus.push(Number(txt.match(/\d+/)[0]));
    const objets = await stockage(`${fig}/`);
    if (Array.isArray(objets) && objets.some((o) => o.name.startsWith(`${entry1}-video-0-`))) break;
    await page.waitForTimeout(250);
  }
  const duree = Date.now() - t0;
  const objets1 = (await stockage(`${fig}/`)).filter((o) => o.name.startsWith(`${entry1}-video-0-`));
  check("Progression affichée et croissante", (cdp ? vus.length >= 2 : vus.length >= 1 || duree < 3000) && vus.every((v, i) => i === 0 || v >= vus[i - 1]), vus.slice(0, 12).join(","));
  check("Vidéo stockée, taille identique à l'original (aucune perte)", objets1.length === 1 && objets1[0].metadata?.size === video.length, `${(video.length / 1e6).toFixed(1)} Mo en ${(duree / 1000).toFixed(1)} s`);
  await page.waitForTimeout(1500);
  check("Interface : plus de barre d'envoi une fois terminé", (await page.locator("text=/Envoi \\d+ %/").count()) === 0);

  // 2. Annulation en cours d'envoi (réseau très lent pour avoir le temps d'annuler)
  await reseau("lent");
  const tok2 = nouvelleDemande();
  const entry2 = sql(`select id from casting_entries where request_token='${tok2}';`);
  await page.goto(`${BASE}/casting/upload/${tok2}`);
  await page.locator('input[type=file][accept="video/*"]').first().setInputFiles({ name: "selftape.webm", mimeType: "video/webm", buffer: video });
  await page.locator("text=/Envoi \\d+ %/").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Annuler" }).first().click();
  await page.waitForTimeout(1500);
  check("Annulation : la barre d'envoi disparaît", (await page.locator("text=/Envoi \\d+ %/").count()) === 0);
  await reseau("rapide");
  await page.waitForTimeout(3000);
  check("Annulation : rien de rattaché à la demande de casting", sql(`select coalesce(array_length(video_storage_paths,1),0) from casting_entries where id='${entry2}';`) === "0");
  const orphelins = (await stockage(`${fig}/`)).filter((o) => o.name.startsWith(`${entry2}-video-`));
  check("Annulation : aucun fichier orphelin dans le stockage (MED-03, limite connue si présent)", orphelins.length === 0, `${orphelins.length} fichier(s)`);
} finally {
  await browser.close();
  const objets = await stockage(`${fig}/`);
  if (Array.isArray(objets) && objets.length) await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/casting-videos`, { method: "DELETE",
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: objets.map((o) => `${fig}/${o.name}`) }) });
  sql(`delete from projets where id='${P}'; delete from figurants where id='${fig}';`);
}
console.table(checks);
const ko = checks.filter((c) => !c.ok && !c.nom.includes("MED-03"));
assert.deepEqual(ko.map((c) => c.nom), [], "Contrôles MED-02 en échec");
console.log(`PASS: MED-02 envoi vidéo (${NAV}).` + (checks.find((c) => c.nom.includes("MED-03"))?.ok ? "" : " Fichier orphelin après annulation : limite MED-03 confirmée."));
