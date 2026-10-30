import type { NextConfig } from "next";

const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const localStorage = storageUrl?.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(storageUrl.hostname)
  && (process.env.NODE_ENV !== "production" || process.env.BOOKING_TEST_MODE === "1");

const nextConfig: NextConfig = {
  // Deux adresses de boucle locale utilisées pour isoler les sessions de recette.
  allowedDevOrigins: ["127.0.0.1"],
  // Sécurité (30/10/2026) : aucun en-tête n'était envoyé. Politique de contenu volontairement limitée aux directives qui
  // ne touchent pas aux scripts de Next (pas de nonce nécessaire) : interdiction d'être affiché dans un cadre
  // (clickjacking), formulaires et <base> limités au site, pas d'objets/plugins.
  poweredByHeader: false,
  async headers() {
    const securite = [
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ];
    // Adresses portant un jeton d'accès : jamais transmises en référent à un autre site.
    const sansReferent = [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }];
    return [
      { source: "/:path*", headers: securite },
      ...["/partage/:path*", "/casting/upload/:path*", "/casting/rejoindre/:path*", "/disponibilites/:path*", "/recu/:path*", "/compte/verifier"]
        .map((source) => ({ source, headers: sansReferent })),
      { source: "/mineurs/:path*", headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
        { key: "Cache-Control", value: "private, no-store, max-age=0" },
      ] },
    ];
  },
  // ffmpeg (allègement des vidéos du casting après l'envoi) : binaire du
  // paquet npm, laissé tel quel et embarqué dans les fonctions concernées.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
  // Les polices de l'affiche sont lues avec readFile au moment du rendu :
  // à embarquer explicitement dans la fonction serveur.
  outputFileTracingIncludes: {
    "/annonces/*/poster": ["./src/app/fonts/*.ttf"],
    "/api/videos/alleger": ["./node_modules/@ffmpeg-installer/**/*"],
    "/api/cron/alleger-videos": ["./node_modules/@ffmpeg-installer/**/*"],
  },
  experimental: {
    // Server Actions default to a 1MB request body — too small for photo
    // uploads (portrait/pied/autres/selfie submitted together from a form).
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // Le proxy (ex-middleware) tronque par défaut tout corps au-delà de 10 Mo : une photo de 10 à 20 Mo
    // (limite annoncée par validateImageUpload) échouait avec « Unexpected end of form » au lieu d'être
    // acceptée ou refusée proprement (BUG-11 / MED-03, 30/10/2026). Aligné sur la limite des actions.
    // NB : en production Vercel, la plateforme limite elle-même les requêtes à ~4,5 Mo.
    proxyClientMaxBodySize: "50mb",
  },
  images: {
    // Autorise l'optimiseur d'images Next.js à passer par le stockage
    // Supabase PUBLIC (prod + local) : les URLs privées signées sont exclues
    // de cet endpoint, y compris lorsqu’un appelant forge _next/image.
    // Sans ça, chaque image publique doit passer en
    // `unoptimized` et sert le fichier original, même pour une vignette de
    // 40px — gros contributeur d'egress inutile.
    remotePatterns: [
      ...(localStorage && storageUrl ? [{ protocol: "http" as const, hostname: storageUrl.hostname, port: storageUrl.port, pathname: "/storage/v1/object/public/**" }] : []),
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/object/public/**" },
      { protocol: "http", hostname: "localhost", port: "54321", pathname: "/storage/v1/object/public/**" },
    ],
    // Next 16 bloque par défaut l'optimisation d'images pointant vers une IP
    // locale (protection SSRF) — nécessaire seulement en dev, où Supabase
    // local tourne sur 127.0.0.1. La prod ne pointe que vers *.supabase.co,
    // jamais une IP locale, donc pas besoin (et pas souhaitable) d'élargir
    // cette protection en prod.
    ...(localStorage ? { dangerouslyAllowLocalIP: true } : {}),
  },
};

export default nextConfig;
