// En-têtes de sécurité HTTP (30/10/2026) : présents sur les pages publiques, staff et routes, pas de X-Powered-By,
// aucun référent sur les adresses à jeton. Usage : node tests/securite-entetes.mjs   (appli sur :3000)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:3000";
// HSTS : seulement si l'appli est construite pour un domaine public en https (sinon il bloquerait http://localhost).
const site = (readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_SITE_URL=(.*)$/m) || [])[1] || "";
const hstsAttendu = /^https:\/\/(?!localhost|127\.0\.0\.1)/.test(site);
const attendus = { "x-frame-options": "DENY", "x-content-type-options": "nosniff", "strict-transport-security": hstsAttendu ? /max-age=\d+/ : /^$/,
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
// CSP complète (02/11/2026) : scripts limités au nonce de la requête (nouveau à chaque fois), sans 'unsafe-inline'.
const scriptSrc = async (chemin) => ((await fetch(BASE + chemin, { redirect: "manual" })).headers.get("content-security-policy") || "").split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src")) || "";
for (const chemin of ["/login", "/", "/compte/connexion"]) {
  const [a, b] = [await scriptSrc(chemin), await scriptSrc(chemin)];
  const nonce = /'nonce-([^']+)'/.exec(a)?.[1];
  if (!nonce || a === b || /'unsafe-inline'|'unsafe-eval'/.test(a)) ko.push(`${chemin} script-src=${a || "absent"}`);
  const html = await (await fetch(BASE + chemin)).text();
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);
  if (scripts.some((t) => !/\snonce="/.test(t))) ko.push(`${chemin} script sans nonce`);
}
// robots.txt : vrai fichier texte, outil d'équipe et liens à jeton exclus de l'indexation.
const robots = await fetch(BASE + "/robots.txt");
const texte = await robots.text();
if (!robots.ok || !/text\/plain/.test(robots.headers.get("content-type") || "")) ko.push(`/robots.txt ${robots.status} ${robots.headers.get("content-type")}`);
for (const d of ["/projets", "/partage/", "/mineurs", "/recu/"]) if (!texte.includes(`Disallow: ${d}`)) ko.push(`/robots.txt sans Disallow: ${d}`);
console.log(ko.length ? ko.join("\n") : "");
assert.deepEqual(ko, [], "En-têtes de sécurité manquants");
console.log("PASS: en-têtes de sécurité présents (clickjacking, nosniff, HSTS selon le domaine, permissions, référent, robots.txt).");
