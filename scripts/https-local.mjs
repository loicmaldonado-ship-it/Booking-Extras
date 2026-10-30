// Relais HTTPS local pour les tests WebKit (30/10/2026). Safari/WebKit n'envoie pas un cookie « Secure » sur
// http://localhost (Chromium et Firefox le font) : la session candidate de `npm start` est donc perdue en HTTP.
// Ce relais sert https://localhost:3443 → http://localhost:3000, avec un certificat auto-signé de test.
// Usage : node scripts/https-local.mjs   puis   BASE=https://localhost:3443 BROWSER=webkit node tests/<test>.mjs
import https from "node:https";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = join(tmpdir(), "booking-https-local");
mkdirSync(dir, { recursive: true });
const key = join(dir, "key.pem"), cert = join(dir, "cert.pem");
if (!existsSync(key)) execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "30", "-subj", "/CN=localhost"], { stdio: "ignore" });
const cible = new URL(process.env.CIBLE || "http://localhost:3000");
const port = Number(process.env.PORT_HTTPS || 3443);
https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
  const amont = http.request({ host: cible.hostname, port: cible.port, method: req.method, path: req.url,
    headers: { ...req.headers, "x-forwarded-proto": "https", "x-forwarded-host": req.headers.host } }, (r) => {
    // Next construit ses redirections absolues en http (il voit http://localhost:3443) : on les remet en https.
    const entetes = { ...r.headers };
    if (typeof entetes.location === "string") entetes.location = entetes.location.replace(/^http:\/\/localhost:/, "https://localhost:");
    res.writeHead(r.statusCode, entetes); r.pipe(res);
  });
  amont.on("error", () => { res.writeHead(502); res.end(); });
  req.pipe(amont);
}).listen(port, () => console.log(`Relais https://localhost:${port} → ${cible.origin}`));
