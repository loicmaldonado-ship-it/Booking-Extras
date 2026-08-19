import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { ProjetPicker } from "@/components/bookings/projet-picker";
import { PartageCard } from "@/components/partage/partage-card";
import { getPartageToken } from "@/lib/partage/actions";
import { getSiteOrigin } from "@/lib/partage/data";
import { getEssayageJournees } from "@/lib/essayages/journees";
import { createEssayageJournee } from "@/lib/essayages/actions";
import { getCurrentProjetId } from "@/lib/projet-context";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { formatDateLong } from "@/lib/format-date";
import { Shirt } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function EssayagesPage({
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
    let q = supabase.from("projets").select("id, nom, confidentiel").order("nom");
    if (accessibleIds !== null) q = q.in("id", idsOrNone(accessibleIds));
    const { data } = await q;
    return data ?? [];
  }

  if (!currentProjetId || params.switch) {
    return <ProjetPicker projets={await accessibleProjets()} redirectTo="/essayages" sectionLabel="Essayages" />;
  }
  if (accessibleIds !== null && !accessibleIds.includes(currentProjetId)) {
    return <ProjetPicker projets={await accessibleProjets()} redirectTo="/essayages" sectionLabel="Essayages" />;
  }

  const { data: projet } = await supabase
    .from("projets")
    .select("nom, confidentiel")
    .eq("id", currentProjetId)
    .single();

  if (!projet) {
    return <ProjetPicker projets={await accessibleProjets()} redirectTo="/essayages" sectionLabel="Essayages" />;
  }

  const journees = await getEssayageJournees(currentProjetId);
  const [partageToken, origin] = await Promise.all([
    getPartageToken(currentProjetId, "essayages"),
    getSiteOrigin(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Projet actuel
            <Link href="/essayages?switch=1" className="ml-2 text-coral hover:underline">
              Changer de projet
            </Link>
          </p>
          <h1 className="flex items-center gap-2 text-3xl font-semibold">
            <Shirt size={28} strokeWidth={1.75} />
            {projet.nom}
          </h1>
          <p className="mt-1 text-text-muted">
            {journees.length} journée{journees.length > 1 ? "s" : ""} d&apos;essayage
          </p>
        </div>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Journées d&apos;essayage</h2>
        <p className="text-sm text-text-muted">
          Clique une journée pour y ajouter des profils et suivre leur essayage.
        </p>
        <div className="flex flex-wrap gap-3">
          {journees.map((j) => (
            <Link
              key={j.id}
              href={`/essayages/journee?projet_id=${j.projet_id}&date=${j.date}`}
              className="flex aspect-square w-52 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-ink px-3 text-center transition-colors hover:border-coral/60"
            >
              <span className="text-xs font-medium uppercase tracking-wide text-text-muted">J{j.numero}</span>
              <span className="text-base font-semibold uppercase leading-tight">{formatDateLong(j.date)}</span>
              {j.lieu && <span className="text-xs text-text-muted">{j.lieu}</span>}
              <Badge tone={j.fait > 0 ? "turquoise" : "default"}>{j.total} au total</Badge>
              <div className="flex gap-1.5">
                <Badge tone="yellow">{j.propose} proposé{j.propose > 1 ? "s" : ""}</Badge>
                <Badge tone="turquoise">{j.fait} fait{j.fait > 1 ? "s" : ""}</Badge>
              </div>
            </Link>
          ))}

          <form
            action={createEssayageJournee.bind(null, currentProjetId)}
            className="flex aspect-square w-52 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-3 text-center"
          >
            <span className="text-sm font-medium text-text-muted">+ Ajouter planning</span>
            <input
              type="date"
              name="date"
              required
              className="w-full rounded-md border border-border bg-ink-raised-2 px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              name="lieu"
              placeholder="Lieu"
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
          <p className="text-sm text-text-muted">Aucune journée d&apos;essayage pour l&apos;instant sur ce projet.</p>
        )}
      </Card>

      <PartageCard
        projetId={currentProjetId}
        type="essayages"
        label={`Partage — Planning essayages « ${projet.nom} »`}
        description="Lien en lecture seule pour que la costumière (ou toute l'équipe) consulte le planning des essayages par jour, sans compte."
        token={partageToken}
        publicBaseUrl={`${origin}/partage/essayages`}
      />
    </div>
  );
}
