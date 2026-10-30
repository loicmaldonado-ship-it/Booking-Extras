// En-têtes de sécurité HTTP (30/10/2026) : présents sur les pages publiques, staff et routes, pas de X-Powered-By,
// aucun référent sur les adresses à jeton. Usage : node tests/securite-entetes.mjs   (appli sur :3000)
import assert from "node:assert/strict";
const BASE = process.env.BASE || "http://localhost:3000";
const attendus = { "x-frame-options": "DENY", "x-content-type-options": "nosniff", "strict-transport-security": /max-age=\d+/,
  "content-security-policy": /frame-ancestors 'none'/, "permissions-policy": /geolocation=\(\)/ };
const ko = [];
for (const chemin of ["/", "/login", "/compte/connexion", "/projets", "/postuler/00000000-0000-4000-8000-00000000a0a0", "/manifest.webmanifest", "/api/erreurs-client"]) {
  const r = await fetch(BASE + chemin, { redirect: "manual", method: chemin.startsWith("/api") ? "POST" : "GET", body: chemin.startsWith("/api") ? "{}" : undefined });
  for (const [k, v] of Object.entries(attendus)) { const h = r.headers.get(k) || ""; if (!(v instanceof RegExp ? v.test(h) : h === v)) ko.push(`${chemin} ${k}=${h || "absent"}`); }
  if (r.headers.get("x-powered-by")) ko.push(`${chemin} x-powered-by présent`);
}
for (const chemin of ["/partage/documents/abc", "/casting/upload/abc", "/recu/abc", "/mineurs/depot/abc"]) {
  const r = await fetch(BASE + chemin, { redirect: "manual" });
  if (r.headers.get("referrer-policy") !== "no-referrer") ko.push(`${chemin} referrer-policy=${r.headers.get("referrer-policy")}`);
}
console.log(ko.length ? ko.join("\n") : "");
assert.deepEqual(ko, [], "En-têtes de sécurité manquants");
console.log("PASS: en-têtes de sécurité présents (clickjacking, nosniff, HSTS, permissions, référent).");
