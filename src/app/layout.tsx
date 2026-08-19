import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { getCurrentProfile } from "@/lib/auth/session";

// Self-hosted (not fetched from Google Fonts at build time): avoids a build
// depending on an external CDN being reachable, which matters both for
// build reliability and for the app's offline-first goals.
const spaceGrotesk = localFont({
  src: [
    { path: "./fonts/SpaceGrotesk-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/SpaceGrotesk-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/SpaceGrotesk-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = localFont({
  src: [{ path: "./fonts/Inter-400.woff2", weight: "400", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Booking Extras",
  description: "Gestion de casting figuration — figurants, projets, annonces, bookings.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Booking Extras",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const profile = await getCurrentProfile();

  return (
    <html
      lang="fr"
      className={`${spaceGrotesk.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col text-text">
        <RegisterServiceWorker />
        <AppShell profile={profile}>{children}</AppShell>
      </body>
    </html>
  );
}
