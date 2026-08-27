import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { getJournees } from "@/lib/bookings/journees";
import { createJournee } from "@/lib/bookings/actions";
import { formatDateLong } from "@/lib/format-date";
import { getCurrentProjetId } from "@/lib/projet-context";
import { ProjetPicker } from "@/components/bookings/projet-picker";
import { JourneeDeleteButton } from "@/components/bookings/journee-delete-button";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

type SearchParams = {
  switch?: string;
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const currentProjetId = await getCurrentProjetId();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;

  async function accessibleProjets() {
    let q = supabase.from("projets").select("id, nom, confidentiel").eq("archive", false).order("nom");
    if (accessibleIds !== null) q = q.in("id", idsOrNone(accessibleIds));
    const { data } = await q;
    return data ?? [];
  }

  if (!currentProjetId || params.switch) {
    return <ProjetPicker projets={await accessibleProjets()} />;
  }

  if (!isOwner(profile) && accessibleIds !== null && !accessibleIds.includes(currentProjetId)) {
    // Accès révoqué (ou jamais accordé) entre-temps : retour au choix de projet.
    // Le compte propriétaire garde un accès direct (ex. depuis /admin) même à
    // un projet qui n'est pas dans sa propre liste.
    return <ProjetPicker projets={await accessibleProjets()} />;
  }

  const { data: projet } = await supabase
    .from("projets")
    .select("nom, confidentiel, lieu")
    .eq("id", currentProjetId)
    .single();

  if (!projet) {
    // Projet supprimé entre-temps : on retombe sur le choix de projet.
    return <ProjetPicker projets={await accessibleProjets()} />;
  }

  const journees = await getJournees(currentProjetId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Projet actuel
            <Link href="/bookings?switch=1" className="ml-2 text-coral hover:underline">
              Changer de projet
            </Link>
          </p>
          <h1 className="flex items-center gap-2 text-3xl font-semibold">
            <BookOpen size={28} strokeWidth={1.75} />
            {projet.nom}
          </h1>
          <p className="mt-1 text-text-muted">
            {journees.length} journée{journees.length > 1 ? "s" : ""}
            {projet.lieu ? ` · ${projet.lieu}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/bookings/resume?projet_id=${currentProjetId}`} variant="secondary">
            Résumé projet
          </ButtonLink>
          <ButtonLink href="/bookings/planning" variant="secondary">
            Planning
          </ButtonLink>
          <ButtonLink href="/candidatures" variant="secondary">
            📄 Candidatures
          </ButtonLink>
          <ButtonLink href="/casting" variant="secondary">
            🎬 Casting
          </ButtonLink>
        </div>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Journées</h2>
        <p className="text-sm text-text-muted">
          Clique une journée pour son tableau de bord : bookings, message, essayage, covoiturage, documents.
        </p>
        <div className="flex flex-wrap gap-3">
          {journees.map((j) => (
            <div key={j.id} className="relative">
              {j.total === 0 && <JourneeDeleteButton journeeId={j.id} />}
              <Link
                href={`/bookings/documents?projet_id=${j.projet_id}&date=${j.date}`}
                className="flex aspect-square w-52 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-ink px-3 text-center transition-colors hover:border-coral/60"
              >
                <span className="text-xs font-medium uppercase tracking-wide text-text-muted">J{j.numero}</span>
                <span className="text-base font-semibold uppercase leading-tight">{formatDateLong(j.date)}</span>
                {j.total_requis ? (
                  <Badge tone={j.actifs >= j.total_requis ? "turquoise" : "yellow"}>
                    {j.actifs}/{j.total_requis}
                  </Badge>
                ) : (
                  <Badge tone={j.confirmes > 0 ? "turquoise" : "default"}>{j.total} au total</Badge>
                )}
                <div className="flex gap-1.5">
                  <Badge tone="turquoise">{j.confirmes} confirmé·e{j.confirmes > 1 ? "s" : ""}</Badge>
                  <Badge tone="yellow">{j.per} PER</Badge>
                </div>
                <div className="flex gap-1.5">
                  <Badge>{j.hommes} H</Badge>
                  <Badge>{j.femmes} F</Badge>
                  {j.nonBinaires > 0 && <Badge>{j.nonBinaires} NB</Badge>}
                </div>
              </Link>
            </div>
          ))}

          <form
            action={createJournee.bind(null, currentProjetId)}
            className="flex aspect-square w-52 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-3 text-center"
          >
            <span className="text-sm font-medium text-text-muted">+ Créer journée</span>
            <input
              type="date"
              name="date"
              required
              className="w-full rounded-md border border-border bg-ink-raised-2 px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="rounded-full bg-ink-raised-2 px-4 py-1.5 text-sm font-medium hover:border hover:border-coral/60"
            >
              Créer
            </button>
          </form>
        </div>
        {journees.length === 0 && (
          <p className="text-sm text-text-muted">Aucune journée pour l&apos;instant sur ce projet.</p>
        )}
      </Card>
    </div>
  );
}
