import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProjetPicker } from "@/components/bookings/projet-picker";
import { AjouterJourneesForm } from "@/components/essayages/ajouter-journees-form";
import { getPresentielJournees } from "@/lib/casting-presentiel/journees";
import { createPresentielJournee, deletePresentielJournee } from "@/lib/casting-presentiel/actions";
import { JourneeDeleteButton } from "@/components/bookings/journee-delete-button";
import { getCurrentProjetId, setCurrentProjet } from "@/lib/projet-context";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { formatDateLong } from "@/lib/format-date";
import { Users } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CastingPresentielPage({
  searchParams,
}: {
  searchParams: Promise<{ switch?: string }>;
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
    return <ProjetPicker projets={await accessibleProjets()} redirectTo="/casting/presentiel" sectionLabel="Casting présentiel" />;
  }
  if (!isOwner(profile) && accessibleIds !== null && !accessibleIds.includes(currentProjetId)) {
    return <ProjetPicker projets={await accessibleProjets()} redirectTo="/casting/presentiel" sectionLabel="Casting présentiel" />;
  }

  const { data: projet } = await supabase.from("projets").select("nom, confidentiel").eq("id", currentProjetId).single();
  if (!projet) {
    return <ProjetPicker projets={await accessibleProjets()} redirectTo="/casting/presentiel" sectionLabel="Casting présentiel" />;
  }

  const journees = await getPresentielJournees(currentProjetId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Projet actuel
            <Link href="/casting/presentiel?switch=1" className="ml-2 text-coral hover:underline">
              Changer de projet
            </Link>
          </p>
          <h1 className="flex items-center gap-2 text-3xl font-semibold">
            <Users size={28} strokeWidth={1.75} />
            {projet.nom} — Casting présentiel
          </h1>
          <p className="mt-1 text-text-muted">
            {journees.length} journée{journees.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/casting"
            className="flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-text-muted hover:border-coral/60 hover:text-text"
          >
            🎬 Casting
          </Link>
          <form action={setCurrentProjet.bind(null, currentProjetId, "/bookings")}>
            <Button type="submit" variant="secondary">
              📋 Bookings
            </Button>
          </form>
        </div>
      </div>

      {journees.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Journées de casting présentiel</h2>
          <p className="text-sm text-text-muted">Clique une journée pour y ajouter des profils et organiser le planning.</p>
          <div className="flex flex-wrap gap-3">
            {journees.map((j) => (
              <div key={j.id} className="relative">
                {j.total === 0 && <JourneeDeleteButton journeeId={j.id} action={deletePresentielJournee} />}
                <Link
                  href={`/casting/presentiel/journee?projet_id=${j.projet_id}&date=${j.date}`}
                  className="flex aspect-square w-52 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-ink px-3 text-center transition-colors hover:border-coral/60"
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-text-muted">J{j.numero}</span>
                  <span className="text-base font-semibold uppercase leading-tight">{formatDateLong(j.date)}</span>
                  <Badge tone={j.confirmes > 0 ? "turquoise" : "default"}>{j.total} au total</Badge>
                  <div className="flex gap-1.5">
                    <Badge tone="turquoise">{j.confirmes} confirmé·e{j.confirmes > 1 ? "s" : ""}</Badge>
                    <Badge tone="coral">{j.valides} validé·e{j.valides > 1 ? "s" : ""}</Badge>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Ajouter des journées</h2>
        <p className="text-sm text-text-muted">
          Clique les jours voulus sur le calendrier (plusieurs à la fois, même sur des mois différents), puis
          valide une seule fois.
        </p>
        <AjouterJourneesForm
          action={createPresentielJournee.bind(null, currentProjetId)}
          existingDates={journees.map((j) => j.date)}
        />
      </Card>
    </div>
  );
}
