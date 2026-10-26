import type { NextConfig } from "next";

const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const localStorage = storageUrl?.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(storageUrl.hostname)
  && (process.env.NODE_ENV !== "production" || process.env.BOOKING_TEST_MODE === "1");

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/mineurs/:path*", headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
    ] }];
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
  },
  images: {
    // Autorise l'optimiseur d'images Next.js à passer par le stockage
    // Supabase (prod + local) : sans ça, chaque <Image> doit passer en
    // `unoptimized` et sert le fichier original, même pour une vignette de
    // 40px — gros contributeur d'egress inutile.
    remotePatterns: [
      ...(localStorage && storageUrl ? [{ protocol: "http" as const, hostname: storageUrl.hostname, port: storageUrl.port, pathname: "/storage/v1/object/**" }] : []),
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/object/**" },
      { protocol: "http", hostname: "localhost", port: "54321", pathname: "/storage/v1/object/**" },
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
