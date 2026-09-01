import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { PresentielJourneeTable } from "@/components/casting-presentiel/presentiel-journee-table";
import { QuickAddFigurantPresentiel } from "@/components/casting-presentiel/quick-add-figurant-presentiel";
import { PresentielLieuField } from "@/components/casting-presentiel/lieu-field";
import { CreneauxPanel, type Creneau } from "@/components/essayages/creneaux-panel";
import { EssayagePlanningBoard, type PlanningRow } from "@/components/essayages/essayage-planning-board";
import {
  addPresentielCreneau,
  removePresentielCreneau,
  generatePresentielCreneaux,
  assignPresentielEntryToCreneau,
} from "@/lib/casting-presentiel/actions";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import type { PresentielEntry } from "@/lib/casting-presentiel/types";
import { formatDateLong } from "@/lib/format-date";
import { Users } from "lucide-react";
import { requireProjetAccess } from "@/lib/auth/session";
import { getProjetSignatureOrOwnerName } from "@/lib/projets/signature";

export const dynamic = "force-dynamic";

export default async function CastingPresentielJourneePage({
  searchParams,
}: {
  searchParams: Promise<{ projet_id?: string; date?: string }>;
}) {
  const { projet_id, date } = await searchParams;

  if (!projet_id || !date) {
    return <p className="text-text-muted">Choisis un projet et une date.</p>;
  }
  await requireProjetAccess(projet_id);

  const supabase = createAdminClient();

  const [{ data: projet }, { data: journee }] = await Promise.all([
    supabase.from("projets").select("nom, confidentiel").eq("id", projet_id).single(),
    supabase.from("casting_presentiel_journees").select("id, lieu").eq("projet_id", projet_id).eq("date", date).single(),
  ]);

  if (!journee) {
    return <p className="text-text-muted">Cette journée de casting présentiel n&apos;existe pas.</p>;
  }

  const [{ data: entriesRaw }, { data: allFigurants }, { data: roles }, { data: creneaux }] = await Promise.all([
    supabase
      .from("casting_presentiel_entries")
      .select(
        "id, statut, notes, creneau_id, figurant_id, role_id, figurants(prenom, nom, telephone, email, genre), casting_roles(nom)"
      )
      .eq("journee_id", journee.id)
      .returns<Omit<PresentielEntry, "portraitUrl">[]>(),
    supabase.from("figurants").select("id, prenom, nom").order("nom"),
    supabase.from("casting_roles").select("id, nom").eq("projet_id", projet_id).order("nom"),
    supabase
      .from("casting_presentiel_creneaux")
      .select("id, heure_debut, heure_fin, capacite")
      .eq("journee_id", journee.id)
      .order("heure_debut")
      .returns<Creneau[]>(),
  ]);

  const figurantIds = (entriesRaw ?? []).map((e) => e.figurant_id);
  const [photosByFigurant, signature] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    getProjetSignatureOrOwnerName(supabase, projet_id),
  ]);
  const rows: PresentielEntry[] = (entriesRaw ?? []).map((e) => ({
    ...e,
    portraitUrl: pickPortrait(photosByFigurant.get(e.figurant_id), projet_id)?.url ?? null,
    photos: photosByFigurant.get(e.figurant_id) ?? [],
  }));
  const planningRows: PlanningRow[] = rows.map((r) => ({
    id: r.id,
    figurant_id: r.figurant_id,
    creneau_id: r.creneau_id ?? null,
    figurants: r.figurants,
    portraitUrl: r.portraitUrl,
  }));

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/casting/presentiel" label="Casting présentiel" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold">
            <Users size={28} strokeWidth={1.75} />
            {projet?.nom} — {formatDateLong(date)}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-text-muted">
            <PresentielLieuField journeeId={journee.id} lieu={journee.lieu} /> · {rows.length} profil
            {rows.length > 1 ? "s" : ""}
          </div>
          <div className="mt-2 flex gap-2">
            <Badge tone="yellow">{rows.filter((r) => r.statut === "proposé").length} proposé·e</Badge>
            <Badge tone="coral">{rows.filter((r) => r.statut === "valide").length} validé·e</Badge>
            <Badge tone="turquoise">{rows.filter((r) => r.statut === "confirmé").length} confirmé·e</Badge>
          </div>
        </div>
        <div className="flex gap-3">
          <ButtonLink href={`/casting/presentiel/journee/planning?projet_id=${projet_id}&date=${date}`} variant="secondary">
            📄 Planning (PDF)
          </ButtonLink>
          <QuickAddFigurantPresentiel
            journeeId={journee.id}
            projetId={projet_id}
            figurants={allFigurants ?? []}
            roles={roles ?? []}
            alreadyAddedIds={figurantIds}
          />
        </div>
      </div>

      <Card>
        <PresentielJourneeTable
          rows={rows}
          roles={roles ?? []}
          creneaux={creneaux ?? []}
          lieu={journee.lieu}
          dateLabel={formatDateLong(date)}
          projetId={projet_id}
          projetNom={projet?.nom ?? ""}
          signature={signature}
        />
      </Card>

      <CreneauxPanel
        creneaux={creneaux ?? []}
        assignments={rows.map((r) => ({ creneau_id: r.creneau_id ?? null, genre: r.figurants?.genre ?? null }))}
        generateCreneaux={generatePresentielCreneaux.bind(null, journee.id)}
        addCreneau={addPresentielCreneau.bind(null, journee.id)}
        removeCreneau={removePresentielCreneau}
      />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-muted">Planning par créneaux</h2>
        <EssayagePlanningBoard
          creneaux={creneaux ?? []}
          rows={planningRows}
          assignToCreneau={assignPresentielEntryToCreneau}
          dragDataKey="text/presentiel-entry-id"
        />
      </Card>
    </div>
  );
}
