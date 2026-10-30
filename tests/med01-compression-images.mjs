// MED-01 (30/10/2026) : compression des photos sur le vrai parcours candidate (/compte → « Ajouter une photo »),
// navigateur Chromium en émulation mobile (Android/Chrome). Mesure poids envoyé, dimensions stockées, orientation, durée.
// Images générées dans le navigateur (aucun fichier ni outil externe). Safari iOS et HEIC réels : recette sur téléphone.
// Usage : node tests/med01-compression-images.mjs   (appli sur :3000, base locale fictive, BOOKING_TEST_MODE=1)
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.equal(env.BOOKING_TEST_MODE, "1");
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: q, encoding: "utf8" }).trim().split("\n").filter(Boolean).pop() ?? "";

// Dimensions d'un JPEG (marqueur SOF) ou d'un PNG (IHDR).
function dims(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: "png" };
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), type: "jpeg" };
    i += 2 + len;
  }
  return null;
}
// Ajoute un segment EXIF Orientation=6 (photo prise téléphone tourné : à afficher pivotée de 90°).
function avecOrientation6(jpeg) {
  const app1 = Buffer.from("FFE10022457869660000" + "4D4D002A00000008" + "0001" + "011200030000000100060000" + "00000000", "hex");
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

const M = "Med" + Date.now().toString(36);
const fig = sql(`insert into figurants(prenom,nom,email,telephone,date_naissance,acces_compte) values('Lou','${M}','${M.toLowerCase()}@example.test','0688${String(Date.now()).slice(-6)}','1990-01-01',true) returning id;`);
sql(`insert into figurant_comptes(figurant_id,password_hash) select '${fig}', password_hash from figurant_comptes where figurant_id='00000000-0000-4000-8000-00000000f001';`);
sql("delete from candidate_auth_attempts;");

const browser = await chromium.launch();
const resultats = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36" });
  const page = await ctx.newPage();
  // Génération des images de test dans le navigateur (bruit = photo difficile à compresser).
  await page.goto(BASE + "/compte/connexion");
  const gen = (w, h, type, q, alpha) => page.evaluate(async ({ w, h, type, q, alpha }) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#c33"); g.addColorStop(1, "#33c"); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { x.fillStyle = `hsla(${(i * 37) % 360},70%,50%,${alpha ? 0.3 : 0.8})`; x.fillRect((i * 7919) % w, (i * 104729) % h, 3 + (i % 60), 3 + (i % 40)); }
    if (alpha) x.clearRect(w / 4, h / 4, w / 2, h / 2);
    const id = x.getImageData(0, 0, Math.min(w, 4000), Math.min(h, 4000)); for (let i = 0; i < id.data.length; i += 4) id.data[i] ^= (i * 2654435761) & 31; x.putImageData(id, 0, 0);
    const b = await new Promise((r) => c.toBlob(r, type, q));
    return await new Promise((r) => { const f = new FileReader(); f.onload = () => r(String(f.result).split(",")[1]); f.readAsDataURL(b); });
  }, { w, h, type, q, alpha }).then((b64) => Buffer.from(b64, "base64"));
  const cas = [
    { nom: "Photo 48 Mpx (8000×6000) JPEG lourde", buf: await gen(8000, 6000, "image/jpeg", 1), mime: "image/jpeg", attendu: "réduite ≤ 1600 px, beaucoup plus légère" },
    { nom: "Portrait EXIF rotation 6 (stockée 4000×3000)", buf: avecOrientation6(await gen(4000, 3000, "image/jpeg", 0.95)), mime: "image/jpeg", attendu: "redressée en portrait (largeur < hauteur)" },
    { nom: "Petite photo sous le seuil (640×480)", buf: await gen(640, 480, "image/jpeg", 0.6), mime: "image/jpeg", attendu: "envoyée telle quelle" },
    { nom: "PNG avec transparence (2400×2400)", buf: await gen(2400, 2400, "image/png", 1, true), mime: "image/png", attendu: "convertie en JPEG (transparence perdue)" },
  ];
  await page.fill("input[type=email]", `${M.toLowerCase()}@example.test`); await page.fill("input[type=password]", "booking-test");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/compte/connexion"), { timeout: 20000 }), page.locator("form button[type=submit]").first().click()]);
  await page.goto(BASE + "/compte");
  for (const c of cas) {
    const avant = Number(sql(`select count(*) from figurant_photos where figurant_id='${fig}';`));
    const t0 = Date.now();
    await page.locator("input[type=file]").first().setInputFiles({ name: `test-${resultats.length}.${c.mime === "image/png" ? "png" : "jpg"}`, mimeType: c.mime, buffer: c.buf });
    for (let i = 0; i < 120 && Number(sql(`select count(*) from figurant_photos where figurant_id='${fig}';`)) === avant; i++) await page.waitForTimeout(500);
    const duree = Date.now() - t0;
    const path = sql(`select storage_path from figurant_photos where figurant_id='${fig}' order by created_at desc limit 1;`);
    const obj = Buffer.from(await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/figurant-photos/${path}`, { headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY } })).arrayBuffer());
    const d0 = dims(c.buf), d1 = dims(obj);
    resultats.push({ cas: c.nom, entree: `${(c.buf.length / 1e6).toFixed(2)} Mo ${d0.w}×${d0.h}`, stocke: d1 ? `${(obj.length / 1e6).toFixed(2)} Mo ${d1.w}×${d1.h} ${d1.type}` : "absent", duree_ms: duree, attendu: c.attendu, _d1: d1, _obj: obj.length, _in: c.buf.length });
  }
} finally {
  await browser.close();
  sql(`delete from figurants where id='${fig}';`);
}
console.table(resultats.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith("_")))));
const [lourde, rot, petite, png] = resultats;
assert.ok(lourde._d1 && Math.max(lourde._d1.w, lourde._d1.h) <= 1600 && lourde._obj < lourde._in / 5, "48 Mpx non réduite");
assert.ok(rot._d1 && rot._d1.w < rot._d1.h, "orientation EXIF non appliquée");
assert.ok(petite._obj === petite._in, "petite photo modifiée alors qu'elle est sous le seuil");
assert.ok(png._d1?.type === "jpeg", "PNG non converti");
// Le fichier stocké est exactement celui envoyé par le navigateur (pas de ré-encodage serveur) : il borne la requête.
assert.ok(resultats.every((r) => r._obj < 4_000_000), "un envoi dépasse ~4 Mo (limite Vercel ~4,5 Mo par requête)");
console.log("PASS: MED-01 compression des photos (Chromium mobile).");
