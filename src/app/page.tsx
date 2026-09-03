import Link from "next/link";
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
  BookOpenCheck,
  type LucideIcon,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { setCurrentProjet } from "@/lib/projet-context";
import { projetNomPublic } from "@/lib/projets/types";
import { formatDateShort } from "@/lib/format-date";

export const dynamic = "force-dynamic";

type DashboardProjet = {
  id: string;
  nom: string;
  confidentiel: boolean;
  nom_code: string | null;
  lieu: string | null;
  date_debut: string | null;
  date_fin: string | null;
};

type DashboardAnnonce = {
  id: string;
  titre: string;
  lieu: string | null;
  date_recherchee: string | null;
  projet_id: string;
  projets: { nom: string; confidentiel: boolean; nom_code: string | null; archive: boolean } | null;
};

const SECTIONS: { label: string; href: string; description: string; icon: LucideIcon; chefOnly?: boolean }[] = [
  { label: "Base Profils", href: "/figurants", description: "Fiches figurant·es, photos, disponibilités", icon: Users },
  { label: "Projets", href: "/projets", description: "Tournages et infos production", icon: Clapperboard },
  { label: "Annonces", href: "/annonces", description: "Offres publiées, candidatures reçues", icon: Megaphone },
  { label: "Candidatures", href: "/candidatures", description: "Trier, répondre, ajouter au booking", icon: FileText },
  { label: "Bookings", href: "/bookings", description: "Journées, convocations, messages", icon: BookOpen },
  { label: "Essayages", href: "/essayages", description: "Planning essayages, mensurations", icon: Shirt },
  { label: "Partage", href: "/partage", description: "Liens publics documents & essayages", icon: Share2 },
  { label: "Modèles", href: "/modeles", description: "Modèles de messages", icon: Mail },
  { label: "Barème", href: "/bareme", description: "Cachets et majorations ACFDA", icon: Calculator },
  { label: "RGPD", href: "/rgpd", description: "Anonymisation, conformité", icon: ShieldCheck },
  { label: "Équipe", href: "/equipe", description: "Inviter des assistant·es", icon: UsersRound, chefOnly: true },
];

export default async function Home() {
  const supabase = createAdminClient();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;
  const today = new Date().toISOString().slice(0, 10);

  let projetsQuery = supabase
    .from("projets")
    .select("id, nom, confidentiel, nom_code, lieu, date_debut, date_fin")
    .eq("archive", false)
    .or(`date_fin.is.null,date_fin.gte.${today}`)
    .order("date_debut", { ascending: true, nullsFirst: false });
  if (accessibleIds !== null) projetsQuery = projetsQuery.in("id", idsOrNone(accessibleIds));

  let annoncesQuery = supabase
    .from("annonces")
    .select("id, titre, lieu, date_recherchee, projet_id, projets(nom, confidentiel, nom_code, archive)")
    .eq("statut", "ouverte")
    .order("date_recherchee", { ascending: true, nullsFirst: false });
  if (accessibleIds !== null) annoncesQuery = annoncesQuery.in("projet_id", idsOrNone(accessibleIds));

  const [{ data: projets }, { data: annoncesRaw }] = await Promise.all([
    projetsQuery.returns<DashboardProjet[]>(),
    annoncesQuery.returns<DashboardAnnonce[]>(),
  ]);
  // Le projet peut être archivé après coup sans que l'annonce elle-même
  // change de statut — filtré ici plutôt que dans la requête (jointure
  // embarquée, plus simple à exclure côté JS qu'en syntaxe PostgREST).
  const annonces = (annoncesRaw ?? []).filter((a) => !a.projets?.archive);

  const annonceIds = (annonces ?? []).map((a) => a.id);
  const { data: candidaturesRaw } =
    annonceIds.length > 0
      ? await supabase.from("candidatures").select("annonce_id").in("annonce_id", annonceIds)
      : { data: [] as { annonce_id: string }[] };
  const candidatureCounts = new Map<string, number>();
  for (const c of candidaturesRaw ?? []) {
    candidatureCounts.set(c.annonce_id, (candidatureCounts.get(c.annonce_id) ?? 0) + 1);
  }

  const sections = SECTIONS.filter((s) => !s.chefOnly || profile?.role === "chef");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <LayoutDashboard size={28} strokeWidth={1.75} />
          Tableau de bord
        </h1>
        <p className="mt-2 text-text-muted">
          {profile?.nom ? `Bienvenue, ${profile.nom}.` : "Bienvenue sur Booking Extras."}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Projets en cours</h2>
        {(projets ?? []).length === 0 ? (
          <Card>
            <p className="text-sm text-text-muted">
              Aucun projet en cours.{" "}
              <Link href="/projets/nouveau" className="text-coral hover:underline">
                Créer un projet
              </Link>
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projets!.map((p) => (
              <form key={p.id} action={setCurrentProjet.bind(null, p.id, "/bookings")}>
                <button
                  type="submit"
                  className="flex w-full flex-col gap-2 rounded-2xl border border-border bg-ink-raised px-5 py-4 text-left transition-colors hover:border-coral/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{projetNomPublic(p)}</span>
                    {p.confidentiel && <Badge tone="coral">Confidentiel</Badge>}
                  </div>
                  <span className="text-xs text-text-muted">
                    {p.date_debut
                      ? `${formatDateShort(p.date_debut)}${p.date_fin ? ` → ${formatDateShort(p.date_fin)}` : ""}`
                      : "Dates à définir"}
                    {p.lieu ? ` · ${p.lieu}` : ""}
                  </span>
                  <span className="text-xs font-medium text-coral">Voir le booking →</span>
                </button>
              </form>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Annonces en cours</h2>
        {(annonces ?? []).length === 0 ? (
          <Card>
            <p className="text-sm text-text-muted">Aucune annonce ouverte pour l&apos;instant.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {annonces!.map((a) => {
              const count = candidatureCounts.get(a.id) ?? 0;
              return (
                <Link
                  key={a.id}
                  href={`/annonces/${a.id}`}
                  className="flex flex-col gap-2 rounded-2xl border border-border bg-ink-raised px-5 py-4 transition-colors hover:border-coral/60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{a.titre}</span>
                    <Badge tone="turquoise">
                      {count} candidature{count > 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <span className="text-xs text-text-muted">
                    {projetNomPublic(a.projets, "Projet confidentiel")}
                    {a.date_recherchee ? ` · ${formatDateShort(a.date_recherchee)}` : ""}
                    {a.lieu ? ` · ${a.lieu}` : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Toutes les sections</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex flex-col gap-1.5 rounded-2xl border border-border bg-ink-raised px-4 py-4 transition-colors hover:border-coral/60"
            >
              <s.icon size={20} strokeWidth={1.75} className="text-coral" />
              <span className="font-medium">{s.label}</span>
              <span className="text-xs text-text-muted">{s.description}</span>
            </Link>
          ))}
        </div>
      </div>

      <Link
        href="/aide"
        className="flex items-center gap-4 rounded-2xl border border-coral/40 bg-coral/10 px-5 py-4 transition-colors hover:border-coral/70"
      >
        <BookOpenCheck size={22} strokeWidth={1.75} className="shrink-0 text-coral" />
        <div>
          <span className="font-medium">Prise en main</span>
          <p className="text-xs text-text-muted">
            Nouveau·elle sur Booking Extras ? Le guide de chaque section, étape par étape.
          </p>
        </div>
      </Link>
    </div>
  );
}
