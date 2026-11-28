// Adresse publique du site (sans « / » final) : sitemap, robots.txt, aperçus de liens.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://booking-extras.vercel.app").replace(/\/+$/, "");
