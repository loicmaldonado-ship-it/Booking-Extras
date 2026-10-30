// BUG-11 : le serveur refuse les fichiers non autorisés indépendamment du navigateur (appli réelle, base locale).
// Usage : node tests/bug11-upload-validation.mjs
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const BASE = process.env.BASE || "http://localhost:3000";
const require = createRequire(import.meta.url);
const NAV = process.env.BROWSER || "chromium"; // chromium | webkit (moteur de Safari) | firefox
const pw = require(process.env.PLAYWRIGHT_PATH || "playwright");
const chromium = (await import("./lib/navigateur.mjs")).navigateur(pw, NAV);
const sharp = require("sharp");
const sql = (q) => execFileSync("docker", ["exec", "-i", process.env.SUPABASE_DB_CONTAINER || "supabase_db_BOOKING_EXTRAS", "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"], { input: `set request.jwt.claim.role='service_role';\n${q}`, encoding: "utf8" }).trim();
const manifest = JSON.parse(readFileSync(".next/server/server-reference-manifest.json", "utf8")).node;
const [UPLOAD_ID] = Object.entries(manifest).find(([, v]) => v.filename === "src/lib/candidats/actions.ts" && v.exportedName === "uploadMaPhoto");
const FIG = "00000000-0000-4000-8000-00000000f001";
const b64 = (b) => Buffer.from(b).toString("base64");
const jpeg = b64(await sharp({ create: { width: 600, height: 800, channels: 3, background: "#a08070" } }).jpeg().toBuffer());
const png = b64(await sharp({ create: { width: 600, height: 800, channels: 3, background: "#a08070" } }).png().toBuffer());
const cases = [
  ["vraie image JPEG", jpeg, "image/jpeg", "ok.jpg", true],
  ["texte renommé en .jpg", b64("ceci n'est pas une image"), "image/jpeg", "faux.jpg", false],
  ["PNG annoncé comme JPEG (faux MIME)", png, "image/jpeg", "ment.jpg", false],
  ["JPEG tronqué (signature seule)", b64(Buffer.from(jpeg, "base64").subarray(0, 64)), "image/jpeg", "tronque.jpg", false],
  ["SVG avec script", b64('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), "image/svg+xml", "x.svg", false],
  ["HTML extension .png", b64("<html><script>alert(1)</script></html>"), "image/png", "page.png", false],
  ["image valide de 15 Mo (entre 10 et 20 Mo)", b64(await sharp({ create: { width: 2600, height: 2000, channels: 3, noise: { type: "gaussian", mean: 128, sigma: 60 } } }).png({ compressionLevel: 0 }).toBuffer()), "image/png", "grande.png", true],
  ["fichier trop lourd (25 Mo)", b64(Buffer.concat([Buffer.from(jpeg, "base64"), Buffer.alloc(25 * 1024 * 1024)])), "image/jpeg", "lourd.jpg", false],
];
const before = Number(sql(`select count(*) from figurant_photos where figurant_id='${FIG}';`));
const browser = await chromium.launch();
const out = [];
try {
  const page = await (await browser.newContext()).newPage();
  await page.goto(BASE + "/compte/connexion");
  await page.fill("input[type=email]", "candidate.test@test-figurant.fr"); await page.fill("input[type=password]", "booking-test");
  await Promise.all([page.waitForURL((u) => u.pathname === "/compte", { timeout: 20000 }), page.locator("form button[type=submit]").first().click()]);
  for (const [name, data, type, filename, attendu] of cases) {
    const result = await page.evaluate(async ({ id, data, type, filename }) => {
      const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
      const fd = new FormData();
      fd.append("_1_type", "autre"); fd.append("_1_photo", new File([bin], filename, { type }));
      fd.append("0", JSON.stringify([null, "$K1"]));
      const r = await fetch("/compte", { method: "POST", headers: { "Next-Action": id, Accept: "text/x-component" }, body: fd });
      return ((await r.text()).split("\n").find((l) => l.startsWith("1:")) || "").slice(2, 200);
    }, { id: UPLOAD_ID, data, type, filename });
    const accepte = /"success":true/.test(result); // une erreur levée (E{digest}) compte comme refus
    out.push({ cas: name, attendu: attendu ? "accepté" : "refusé", obtenu: accepte ? "accepté" : "refusé", reponse: result.slice(0, 90) });
    if (name.startsWith("fichier trop lourd")) assert.match(result, /trop lourde/, "Un fichier trop lourd doit recevoir un message clair, pas une erreur serveur");
  }
  // PDF de rôle casting (route API staff)
  const staff = await (await browser.newContext()).newPage();
  await staff.goto(BASE + "/login"); await staff.fill("input[type=email]", "cheffe.test@test-chat-charge.fr"); await staff.fill("input[type=password]", "booking-test");
  await Promise.all([staff.waitForURL((u) => !u.pathname.startsWith("/login")), staff.locator("form button[type=submit]").first().click()]);
  const role = sql("insert into casting_roles(projet_id,nom) values('00000000-0000-4000-8000-0000000070e0','PDF test') returning id;").split("\n").pop();
  for (const [name, content, type, attendu] of [["faux PDF (texte)", "pas un pdf", "application/pdf", false], ["vrai en-tête PDF", "%PDF-1.4\n%%EOF", "application/pdf", true], ["PDF annoncé en text/html", "%PDF-1.4\n%%EOF", "text/html", false]]) {
    const status = await staff.evaluate(async ({ role, content, type }) => { const fd = new FormData(); fd.append("pdf", new File([content], "doc.pdf", { type })); return (await fetch(`/casting/roles/${role}/pdf`, { method: "POST", body: fd })).status; }, { role, content, type });
    out.push({ cas: "PDF rôle : " + name, attendu: attendu ? "accepté" : "refusé", obtenu: status === 200 ? "accepté" : "refusé", reponse: String(status) });
  }
  sql(`delete from casting_roles where id='${role}';`);
} finally {
  await browser.close();
  const added = sql(`select string_agg(id::text, ',') from figurant_photos where figurant_id='${FIG}' and created_at > now() - interval '10 minutes';`);
  if (added) sql(`delete from figurant_photos where id in (${added.split(",").map((x) => `'${x}'`).join(",")});`);
}
console.table(out);
assert.deepEqual(out.filter((o) => o.attendu !== o.obtenu).map((o) => o.cas), [], "Validation des fichiers incorrecte");
assert.equal(Number(sql(`select count(*) from figurant_photos where figurant_id='${FIG}';`)), before, "Photos de test non nettoyées");
console.log("PASS: le serveur n'accepte que les vraies images / vrais PDF, quel que soit le type annoncé par le navigateur.");
