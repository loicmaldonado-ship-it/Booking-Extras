import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { EssayageJourneeTable, type EssayageRow } from "@/components/essayages/essayage-journee-table";
import { QuickAddFigurantEssayage } from "@/components/essayages/quick-add-figurant-essayage";
import { CreneauxPanel, type Creneau } from "@/components/essayages/creneaux-panel";
import { addCreneau, removeCreneau, generateCreneaux, assignFigurantToCreneau } from "@/lib/essayages/actions";
import { EssayagePlanningBoard, type PlanningRow } from "@/components/essayages/essayage-planning-board";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { getEssayageJournees } from "@/lib/essayages/journees";
import { getEssayageLieuProjet } from "@/lib/essayages/lieu";
import { formatDateLong } from "@/lib/format-date";
import { Shirt } from "lucide-react";
import { requireProjetAccess } from "@/lib/auth/session";
import { getProjetSignatureOrOwnerName } from "@/lib/projets/signature";

export const dynamic = "force-dynamic";

export default async function EssayageJourneePage({
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

  const [{ data: projet }, { data: journee }, essayageLieu, resolvedSignature] = await Promise.all([
    supabase.from("projets").select("nom, confidentiel, signature").eq("id", projet_id).single(),
    supabase.from("essayage_journees").select("id").eq("projet_id", projet_id).eq("date", date).single(),
    getEssayageLieuProjet(projet_id),
    getProjetSignatureOrOwnerName(supabase, projet_id),
  ]);

  if (!journee) {
    return <p className="text-text-muted">Cette journée d&apos;essayage n&apos;existe pas.</p>;
  }

  const [{ data: essayagesRaw }, { data: allFigurants }, { data: creneaux }] = await Promise.all([
    supabase
      .from("essayages")
      .select(
        "id, statut, heure, notes, reponse_recue, creneau_id, numero_costume, figurant_id, lieu, adresse, figurants(prenom, nom, telephone, email, genre)"
      )
      .eq("essayage_journee_id", journee.id)
      .returns<Omit<EssayageRow, "portraitUrl">[]>(),
    supabase.from("figurants").select("id, prenom, nom").order("nom"),
    supabase
      .from("essayage_creneaux")
      .select("id, heure_debut, heure_fin, capacite")
      .eq("essayage_journee_id", journee.id)
      .order("heure_debut")
      .returns<Creneau[]>(),
  ]);

  const figurantIds = (essayagesRaw ?? []).map((e) => e.figurant_id);
  const photosByFigurant = await getPhotosByFigurantId(figurantIds);
  const autresJournees = (await getEssayageJournees(projet_id)).filter((j) => j.id !== journee.id);
  const rows: EssayageRow[] = (essayagesRaw ?? []).map((e) => ({
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
      <BackLink href="/essayages" label="Essayages" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold">
            <Shirt size={28} strokeWidth={1.75} />
            {projet?.nom} — {formatDateLong(date)}
          </h1>
          <p className="mt-1 text-text-muted">
            {essayageLieu.nom ?? "Lieu non calibré"} · {rows.length} profil{rows.length > 1 ? "s" : ""}
          </p>
          <div className="mt-2 flex gap-2">
            <Badge tone="yellow">{rows.filter((r) => r.statut === "proposé").length} proposé·e</Badge>
            <Badge tone="coral">{rows.filter((r) => r.statut === "confirmé").length} confirmé·e</Badge>
            <Badge tone="turquoise">{rows.filter((r) => r.statut === "fait").length} fait·e</Badge>
          </div>
        </div>
        <div className="flex gap-3">
          <ButtonLink href={`/essayages/documents/suivi?projet_id=${projet_id}`} variant="secondary">
            Doc de suivi
          </ButtonLink>
          <QuickAddFigurantEssayage
            essayageJourneeId={journee.id}
            projetId={projet_id}
            date={date}
            lieu={essayageLieu.nom}
            adresse={essayageLieu.adresse}
            figurants={allFigurants ?? []}
            alreadyAddedIds={figurantIds}
          />
        </div>
      </div>

      <Card>
        <EssayageJourneeTable
          rows={rows}
          projetId={projet_id}
          projetNom={projet?.nom ?? ""}
          signature={projet?.signature || resolvedSignature}
          journeeDate={date}
          journeeLieu={essayageLieu.nom}
          journeeAdresse={essayageLieu.adresse}
          creneaux={creneaux ?? []}
          autresJournees={autresJournees}
        />
      </Card>

      <CreneauxPanel
        creneaux={creneaux ?? []}
        assignments={rows.map((r) => ({ creneau_id: r.creneau_id ?? null, genre: r.figurants?.genre ?? null }))}
        generateCreneaux={generateCreneaux.bind(null, journee.id)}
        addCreneau={addCreneau.bind(null, journee.id)}
        removeCreneau={removeCreneau}
      />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-text-muted">Planning par créneaux</h2>
        <EssayagePlanningBoard
          creneaux={creneaux ?? []}
          rows={planningRows}
          assignToCreneau={assignFigurantToCreneau}
        />
      </Card>
    </div>
  );
}
