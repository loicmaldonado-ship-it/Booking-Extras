/**
 * QA-04 / ENV-04 — contrôle HTTP NON destructif des pages publiques.
 * N'envoie ni mot de passe, ni cookie, ni token réel. Refuse toute cible hors
 * boucle locale (ne jamais tester la production avec ce script).
 * Utilisation avec Next.js déjà démarré : node scripts/smoke-readonly-local.mjs
 */
const base = process.env.BOOKING_SMOKE_BASE ?? "http://127.0.0.1:3000";
const url = new URL(base);
if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) || url.username || url.password || url.search || url.hash) {
  throw new Error("Smoke test refusé : utiliser une URL HTTP locale sans identifiants.");
}

const paths = ["/", "/compte/connexion", "/compte/inscription", "/aide", "/postuler/token-invalide-test"];
let failures = 0;
for (const path of paths) {
  try {
    const response = await fetch(new URL(path, url), {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      headers: { "accept": "text/html" },
      signal: AbortSignal.timeout(20000),
    });
    const ok = response.status < 500;
    console.log(`${ok ? "OK" : "ÉCHEC"} ${path} : HTTP ${response.status}`);
    if (!ok) failures++;
    await response.body?.cancel();
  } catch (err) {
    failures++;
    console.log(`ÉCHEC ${path} : ${err instanceof Error ? err.name : "réseau"}`);
  }
}
if (failures > 0) {
  console.error(`${failures} échec(s) : vérifier les logs de Next.js.`);
  process.exitCode = 1;
} else {
  console.log("Smoke HTTP non destructif terminé. Cela ne valide pas les sessions, RLS ou la persistance.");
}
