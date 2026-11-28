// Dépose dans le Storage LOCAL l'avatar fictif référencé par supabase/seed.sql (seed/avatar-cheffe.png).
// Sans lui, chaque page d'équipe affichait une erreur 400 dans la console (image introuvable), relevée par Lighthouse.
// Image générée (pastille unie + initiales), aucune photo réelle. Base locale uniquement. Usage : node scripts/seed-medias-local.mjs
import { readFileSync } from "node:fs";
import sharp from "sharp";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const base = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(base || "")) { console.error("Base locale uniquement"); process.exit(1); }
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#4a5f45"/><text x="128" y="150" font-size="96" font-family="sans-serif" fill="#fff" text-anchor="middle">CC</text></svg>`;
const png = await sharp(Buffer.from(svg)).png().toBuffer();
const r = await fetch(`${base}/storage/v1/object/profile-avatars/seed/avatar-cheffe.png`, {
  method: "POST",
  headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "image/png", "x-upsert": "true" },
  body: png,
});
if (!r.ok) { console.error("Échec du dépôt de l'avatar fictif :", r.status, await r.text()); process.exit(1); }
console.log("Avatar fictif du seed déposé.");
