import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/**" },
      { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: "/storage/v1/object/**" },
      { protocol: "http", hostname: "localhost", port: "54321", pathname: "/storage/v1/object/**" },
    ],
    // Next 16 bloque par défaut l'optimisation d'images pointant vers une IP
    // locale (protection SSRF) — nécessaire seulement en dev, où Supabase
    // local tourne sur 127.0.0.1. La prod ne pointe que vers *.supabase.co,
    // jamais une IP locale, donc pas besoin (et pas souhaitable) d'élargir
    // cette protection en prod.
    ...(process.env.NODE_ENV !== "production" ? { dangerouslyAllowLocalIP: true } : {}),
  },
};

export default nextConfig;
