// Recette (02/11/2026) : la propriétaire crée une deuxième cheffe depuis /admin, l'invitation est capturée dans la boîte
// locale (Mailpit), le lien ouvre l'appli, la cheffe choisit son mot de passe, se connecte et ne voit aucun projet de
// l'autre équipe. Base et application locales uniquement ; compte fictif supprimé à la fin.
// Usage : node tests/invitation-cheffe-e2e.mjs   (appli sur :3000 ; MAILPIT=http://127.0.0.1:54324)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const BASE = process.env.BASE || "http://localhost:3000";
const MAILPIT = process.env.MAILPIT || "http://127.0.0.1:54324";
const require = createRequire(import.meta.url);
const pw = require(process.env.PLAYWRIGHT_PATH || "playwright");
const navigateur = (await import("./lib/navigateur.mjs")).navigateur(pw, process.env.BROWSER || "chromium");
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
assert.match(env.NEXT_PUBLIC_SUPABASE_URL, /^http:\/\/(127\.0\.0\.1|localhost)/, "Base locale uniquement");
const admin = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
const email = `cheffe2-${Date.now()}@example.test`;
const b = await navigateur.launch();
let userId = null;
try {
  // 1. La propriétaire invite la deuxième cheffe.
  const proprio = await (await b.newContext()).newPage();
  await proprio.goto(BASE + "/login"); await proprio.fill("input[type=email]", "cheffe.test@test-chat-charge.fr"); await proprio.fill("input[type=password]", "booking-test");
  await Promise.all([proprio.waitForURL((u) => !u.pathname.startsWith("/login")), proprio.locator("form button[type=submit]").first().click()]);
  await proprio.goto(BASE + "/admin");
  await proprio.locator('input[name="email"][type="email"]').first().fill(email);
  await proprio.getByRole("button", { name: "Inviter" }).first().click();
  await proprio.getByText("Compte chef·fe créé").waitFor({ timeout: 20000 });
  const projetsProprio = await proprio.evaluate(() => document.body.innerText);

  // 2. L'invitation arrive dans la boîte locale.
  let lien = null;
  for (let i = 0; i < 30 && !lien; i++) {
    const r = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent("to:" + email)}`)).json();
    const id = r.messages?.[0]?.ID;
    if (id) {
      const m = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
      lien = (`${m.HTML || ""} ${m.Text || ""}`.match(/https?:\/\/[^\s"'<>]+verify[^\s"'<>]+/) || [])[0]?.replace(/&amp;/g, "&") ?? null;
    }
    if (!lien) await new Promise((res) => setTimeout(res, 500));
  }
  assert.ok(lien, "invitation absente de la boîte locale");

  // 3. La cheffe ouvre le lien, choisit son mot de passe et arrive dans l'appli.
  const cheffe = await (await b.newContext()).newPage();
  await cheffe.goto(lien);
  await cheffe.waitForURL((u) => u.pathname.startsWith("/auth/invite"), { timeout: 20000 });
  assert.equal(new URL(cheffe.url()).origin, new URL(BASE).origin, `le lien renvoie vers ${cheffe.url()} au lieu de ${BASE}`);
  await cheffe.locator('input[type="password"]').fill("booking-test-2");
  await cheffe.getByRole("button", { name: "Créer mon accès" }).click();
  await cheffe.waitForURL((u) => u.pathname === "/", { timeout: 20000 });

  // 4. Elle se reconnecte avec son mot de passe et ne voit aucun projet de l'autre équipe.
  await cheffe.context().clearCookies();
  await cheffe.goto(BASE + "/login"); await cheffe.fill("input[type=email]", email); await cheffe.fill("input[type=password]", "booking-test-2");
  await Promise.all([cheffe.waitForURL((u) => !u.pathname.startsWith("/login")), cheffe.locator("form button[type=submit]").first().click()]);
  await cheffe.goto(BASE + "/projets");
  const vus = await cheffe.evaluate(() => document.body.innerText);
  assert.ok(!vus.includes("Projet de test"), "la deuxième cheffe voit un projet de l'autre équipe");
  userId = (await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: admin })).json()).users?.find((u) => u.email === email)?.id ?? null;
  assert.ok(projetsProprio.length > 0);
  console.log("PASS: deuxième cheffe — invitation capturée, lien vers l'appli, mot de passe choisi, connexion, équipes séparées.");
} finally {
  await b.close();
  if (!userId) userId = (await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, { headers: admin })).json()).users?.find((u) => u.email === email)?.id ?? null;
  if (userId) await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: admin });
}
