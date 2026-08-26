"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Clapperboard,
  Megaphone,
  FileText,
  BookOpen,
  Shirt,
  Share2,
  Mail,
  Calculator,
  ShieldCheck,
  UsersRound,
  Video,
  Crown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { signOut } from "@/lib/auth/actions";
import { CommandPalette } from "@/components/command-palette";
import { NotificationsBell } from "@/components/notifications-bell";
import { MyAvatarMenu } from "@/components/my-avatar-menu";
import { TeamPresenceStrip } from "@/components/team-presence-strip";
import { isOwner } from "@/lib/auth/owner";
import type { CurrentProfile } from "@/lib/auth/session";
import { Logo } from "@/components/ui/logo";

const NAV_ITEMS: { label: string; href: string; enabled: boolean; icon: LucideIcon }[] = [
  { label: "Tableau de bord", href: "/", enabled: true, icon: LayoutDashboard },
  { label: "Base Profils", href: "/figurants", enabled: true, icon: Users },
  { label: "Projets", href: "/projets", enabled: true, icon: Clapperboard },
  { label: "Annonces", href: "/annonces", enabled: true, icon: Megaphone },
  { label: "Candidatures", href: "/candidatures", enabled: true, icon: FileText },
  { label: "Bookings", href: "/bookings", enabled: true, icon: BookOpen },
  { label: "Essayages", href: "/essayages", enabled: true, icon: Shirt },
  { label: "Casting", href: "/casting", enabled: true, icon: Video },
  { label: "Partage", href: "/partage", enabled: true, icon: Share2 },
  { label: "Modèles", href: "/modeles", enabled: true, icon: Mail },
  { label: "Barème", href: "/bareme", enabled: true, icon: Calculator },
  { label: "RGPD", href: "/rgpd", enabled: true, icon: ShieldCheck },
];

// Public pages (the annonce application link handed out to non-users, and
// the login screen itself) skip the internal admin chrome entirely — no
// nav, no mention of other sections. Note: only the /partage/documents and
// /partage/essayages sub-paths are public — /partage itself (link
// management) stays behind auth.
const PUBLIC_PREFIXES = [
  "/postuler",
  "/confidentialite",
  "/login",
  "/auth/invite",
  "/disponibilites",
  "/partage/documents",
  "/partage/essayages",
  "/partage/casting",
  "/casting/upload",
  "/compte",
];

export function AppShell({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: CurrentProfile | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  // The documents/essayages share pages render full-width landscape PDF
  // sheets (up to 1123px) — they need a much wider container than the
  // narrow candidate-facing forms (postuler, disponibilites, login).
  const isWidePublic =
    pathname?.startsWith("/partage/documents") || pathname?.startsWith("/partage/essayages");

  // Fiche membre obligatoire pour les cheffes (photo, nom, prénom,
  // téléphone) — tant qu'elle n'est pas complète, on bloque le reste de
  // l'appli plutôt que de laisser une fiche vide traîner indéfiniment.
  const needsProfileCompletion =
    !isPublic && profile?.role === "chef" && !profile.profileComplete && pathname !== "/mon-compte";
  useEffect(() => {
    if (needsProfileCompletion) router.replace("/mon-compte");
  }, [needsProfileCompletion, router]);

  if (isPublic) {
    return (
      <main className={cn("mx-auto w-full px-6 py-10", isWidePublic ? "max-w-6xl" : "max-w-2xl")}>
        {children}
      </main>
    );
  }

  if (needsProfileCompletion) {
    return <main className="mx-auto w-full max-w-2xl px-6 py-10" />;
  }

  const navItems = [
    ...NAV_ITEMS,
    ...(profile?.role === "chef"
      ? [{ label: "Équipe", href: "/equipe", enabled: true, icon: UsersRound }]
      : []),
    ...(isOwner(profile) ? [{ label: "Admin", href: "/admin", enabled: true, icon: Crown }] : []),
  ];

  const current = navItems.find((item) => (item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href)));
  const CurrentIcon = current?.icon;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="print:hidden relative z-50 flex items-center justify-between border-b border-border bg-ink-raised px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="shrink-0">
            <Logo iconSize={30} textClassName="text-lg" />
          </Link>

          {pathname !== "/" && (
            <button
              type="button"
              onClick={() => router.back()}
              className="flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:border-coral/60 hover:text-text"
            >
              ← <span className="hidden sm:inline">Retour</span>
            </button>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-coral/60"
            >
              {CurrentIcon && <CurrentIcon size={16} strokeWidth={1.75} />}
              <span className="hidden sm:inline">{current?.label ?? "Menu"}</span>
              <span className={cn("text-text-muted transition-transform", menuOpen && "rotate-180")}>▾</span>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <nav className="absolute left-0 top-full z-50 mt-2 flex w-64 flex-col gap-1 rounded-xl border border-border bg-ink-raised-2 p-2 shadow-xl">
                  {navItems.map((item) =>
                    item.enabled ? (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-ink-raised hover:text-text",
                          item === current ? "bg-ink-raised text-coral" : "text-text-muted"
                        )}
                      >
                        <item.icon size={16} strokeWidth={1.75} />
                        {item.label}
                      </Link>
                    ) : (
                      <span
                        key={item.href}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-text-muted/40"
                        title="Bientôt disponible"
                      >
                        {item.label}
                        <span className="rounded-full bg-ink-raised px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          bientôt
                        </span>
                      </span>
                    )
                  )}
                </nav>
              </>
            )}
          </div>
        </div>

        {profile && (
          <div className="flex items-center gap-3">
            <TeamPresenceStrip />
            <NotificationsBell />
            <CommandPalette />
            <div className="hidden text-right text-xs sm:block">
              <div className="truncate font-medium text-text">{profile.email}</div>
              <div className="text-text-muted">{profile.role === "chef" ? "Chef·fe" : "Assistant·e"}</div>
            </div>
            <MyAvatarMenu profile={profile} signOutAction={signOut} />
            <form action={signOut} className="hidden sm:block">
              <button
                type="submit"
                className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:border-coral/60 hover:text-text"
              >
                Se déconnecter
              </button>
            </form>
          </div>
        )}
      </header>
      <main className="flex-1 px-6 py-8 md:px-10 md:py-10 print:p-0">{children}</main>
    </div>
  );
}
