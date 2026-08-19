import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Booking Extras",
    short_name: "Booking Extras",
    description:
      "Gestion de casting figuration — figurants, projets, annonces, bookings.",
    start_url: "/",
    display: "standalone",
    background_color: "#10141f",
    theme_color: "#10141f",
    lang: "fr",
    icons: [
      { src: "/manifest-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/manifest-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/manifest-icon/192?maskable",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/manifest-icon/512?maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
