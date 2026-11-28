import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

// Seules les pages publiques et stables sont listées. Les annonces ne le sont pas : certaines concernent des
// projets confidentiels, et une annonce fermée ne doit pas rester dans Google.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/confidentialite`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
