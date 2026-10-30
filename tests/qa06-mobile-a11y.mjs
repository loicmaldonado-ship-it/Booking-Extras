// QA-06 / BUG-17 (mobile) et QA-07 / BUG-18 (accessibilité de base) — 30/10/2026.
// Visite chaque écran à 375 px de large (iPhone SE/mini) avec les comptes fictifs du seed et relève :
//  - débordement horizontal de la page (scrollWidth > largeur de l'écran) et l'élément le plus large en cause ;
//  - champs de formulaire sans nom accessible, boutons/liens sans texte, images sans alt, <html lang> absent.
// Aucun outil supplémentaire (pas d'axe-core) : contrôles DOM ciblés. Ne remplace pas un test au lecteur d'écran.
// Usage : node tests/qa06-mobile-a11y.mjs [--json]   (appli sur :3000, base locale avec seed)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const BASE = process.env.BASE || "http://localhost:3000";
const P = "00000000-0000-4000-8000-0000000070e0", ANN = "00000000-0000-4000-8000-00000000a000", ANN_TOK = "00000000-0000-4000-8000-00000000a0a0";
const CAND = "00000000-0000-4000-8000-00000000cd01", FIG = "00000000-0000-4000-8000-00000000f001";
const staff = ["/", "/projets", `/projets/${P}`, `/projets/${P}/modifier`, "/projets/nouveau", `/projets/${P}/mineurs`, "/annonces", `/annonces/${ANN}`,
  `/annonces/${ANN}/modifier`, "/annonces/nouveau", "/candidatures", `/candidatures/${CAND}`, "/bookings", "/bookings/nouveau", "/bookings/reserve",
  "/bookings/resume", "/bookings/documents", "/casting", "/casting/distribution", "/casting/presentiel", "/essayages", "/essayages/nouveau",
  "/figurants", `/figurants/${FIG}`, `/figurants/${FIG}/modifier`, "/figurants/nouveau", "/equipe", "/bareme", "/modeles", "/mineurs", "/mon-compte",
  "/aide", "/partage", "/admin", "/admin/agents", "/admin/references", "/admin/support"];
const publics = ["/login", "/compte/connexion", "/compte/inscription", "/compte/creer", "/auth/forgot-password", "/confidentialite", "/rgpd", `/postuler/${ANN_TOK}`, "/offline"];
const candidate = ["/compte"];

const audit = () => {
  const vw = document.documentElement.clientWidth;
  const res = { overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw, coupable: "", sansNom: [], sansAlt: 0, lang: document.documentElement.lang || "" };
  if (res.overflow > 1) {
    let pire = null;
    for (const el of document.body.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 1) continue;
      let p = el.parentElement, clippe = false;
      while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === "auto" || o === "scroll" || o === "hidden") { clippe = true; break; } p = p.parentElement; }
      if (!clippe && (!pire || r.right > pire.r)) pire = { r: r.right, d: `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")} « ${(el.textContent || "").trim().slice(0, 30)} »` };
    }
    res.coupable = pire?.d || "";
  }
  const nom = (el) => (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title") || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest("label") || "").toString().trim();
  for (const el of document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea")) {
    if (el.offsetParent === null) continue;
    if (!nom(el)) res.sansNom.push(`${el.tagName.toLowerCase()}[type=${el.type}][name=${el.name || "?"}][placeholder=${(el.placeholder || "").slice(0, 20)}][class=${String(el.className).slice(0, 40)}]`);
  }
  for (const el of document.querySelectorAll("button, a[href], [role=button]")) {
    if (el.offsetParent === null) continue;
    const t = (el.textContent || "").trim() || el.getAttribute("aria-label") || el.getAttribute("title") || el.querySelector("img[alt]:not([alt=''])")?.alt || el.querySelector("svg title")?.textContent;
    if (!t) res.sansNom.push(`${el.tagName.toLowerCase()} sans texte (${(el.getAttribute("href") || String(el.className)).slice(0, 40)})`);
  }
  res.sansAlt = [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length;
  return res;
};

async function login(browser, path, email) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  if (path) {
    await p.goto(BASE + path); await p.fill("input[type=email]", email); await p.fill("input[type=password]", "booking-test");
    await Promise.all([p.waitForURL((u) => !u.pathname.startsWith(path), { timeout: 20000 }), p.locator("form button[type=submit]").first().click()]);
  }
  return p;
}
const browser = await chromium.launch();
const rows = [];
try {
  const groupes = [["cheffe", await login(browser, "/login", "cheffe.test@test-chat-charge.fr"), staff],
    ["assistante", await login(browser, "/login", "assistante.test@test-chat-charge.fr"), ["/", "/projets", "/candidatures", "/bookings", "/casting", "/essayages", "/figurants", "/mon-compte"]],
    ["candidate", await login(browser, "/compte/connexion", "candidate.test@test-figurant.fr"), candidate],
    ["public", await login(browser, null), publics]];
  for (const [role, page, routes] of groupes) for (const route of routes) {
    const r = await page.goto(BASE + route, { waitUntil: "networkidle" }).catch(() => null);
    const a = await page.evaluate(audit);
    rows.push({ role, route, http: r?.status(), arrivee: new URL(page.url()).pathname, ...a });
  }
} finally { await browser.close(); }

if (process.argv.includes("--json")) console.log(JSON.stringify(rows, null, 1));
const deb = rows.filter((r) => r.overflow > 1), a11y = rows.filter((r) => r.sansNom.length || r.sansAlt || !r.lang);
console.log(`${rows.length} écrans à 375 px. Débordements : ${deb.length}. Écrans avec défaut d'accessibilité de base : ${a11y.length}.`);
for (const r of deb) console.log(`DEBORDEMENT ${r.role} ${r.route} +${r.overflow}px ${r.coupable}`);
for (const r of a11y) console.log(`A11Y ${r.role} ${r.route} lang=${r.lang || "ABSENT"} sansAlt=${r.sansAlt} ${r.sansNom.slice(0, 4).join(" | ")}${r.sansNom.length > 4 ? ` (+${r.sansNom.length - 4})` : ""}`);
process.exit(deb.length || a11y.length ? 1 : 0);
