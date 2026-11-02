// Menu « Mineurs / DRIEETS » (02/11/2026) : sans projet actif, la page propose les projets au lieu de renvoyer sans
// explication vers /projets ; avec un projet actif, elle ouvre directement ses dossiers mineurs.
// Usage : node tests/mineurs-entree-menu.mjs   (appli sur :3000, seed local)
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const BASE = process.env.BASE || "http://localhost:3000";
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || "playwright");
const navigateur = (await import("./lib/navigateur.mjs")).navigateur(pw, process.env.BROWSER || "chromium");
const b = await navigateur.launch();
try {
  const ctx = await b.newContext(); const p = await ctx.newPage();
  await p.goto(BASE + "/login"); await p.fill("input[type=email]", "cheffe.test@test-chat-charge.fr"); await p.fill("input[type=password]", "booking-test");
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login")), p.locator("form button[type=submit]").first().click()]);
  for (const c of await ctx.cookies()) if (/projet/i.test(c.name) && !/^sb-/.test(c.name)) await ctx.clearCookies({ name: c.name });
  await p.goto(BASE + "/mineurs");
  assert.equal(new URL(p.url()).pathname, "/mineurs", `sans projet actif : arrivée sur ${p.url()}`);
  await p.getByRole("heading", { name: "Mineurs / DRIEETS" }).waitFor();
  const lien = p.locator('a[href^="/projets/"][href$="/mineurs"]').first();
  assert.ok(await lien.count(), "aucun projet proposé");
  await lien.click();
  await p.waitForURL(/\/projets\/[0-9a-f-]{36}\/mineurs$/);
  assert.ok(!/This page could not be found|Une erreur est survenue/.test(await p.locator("body").innerText()), "page des dossiers en erreur");
  console.log("PASS: menu Mineurs — choix du projet sans projet actif, dossiers mineurs du projet ensuite.");
} finally {
  await b.close();
}
