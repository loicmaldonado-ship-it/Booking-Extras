import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPhotosByFigurantId, pickFichePhotos } from "@/lib/documents/data";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { MensurationSheet } from "@/components/documents/mensuration-sheet";
import { formatDateShort } from "@/lib/format-date";
import type { Figurant } from "@/lib/figurants/types";
import { requireProjetAccess } from "@/lib/auth/session";

type Row = {
  id: string;
  date: string | null;
  heure: string | null;
  lieu: string | null;
  numero_costume: string | null;
  creneau_id: string | null;
  figurants: Figurant | null;
};

function heureLabel(h: string) {
  return h.slice(0, 5);
}

export default async function SuiviEssayagesPage({
  searchParams,
}: {
  searchParams: Promise<{ projet_id?: string }>;
}) {
  const { projet_id } = await searchParams;

  if (!projet_id) {
    return <p className="text-text-muted">Choisis un projet.</p>;
  }
  await requireProjetAccess(projet_id);

  const supabase = createAdminClient();
  const [{ data: projet }, { data: essayagesRaw }] = await Promise.all([
    supabase.from("projets").select("nom, realisateur, societe_production").eq("id", projet_id).single(),
    supabase
      .from("essayages")
      .select("id, date, heure, lieu, numero_costume, creneau_id, figurants(*)")
      .eq("projet_id", projet_id)
      .eq("statut", "fait")
      .returns<Row[]>(),
  ]);

  const essayages = essayagesRaw ?? [];

  const creneauIds = essayages.map((e) => e.creneau_id).filter((id): id is string => !!id);
  const { data: creneauxRaw } =
    creneauIds.length > 0
      ? await supabase.from("essayage_creneaux").select("id, heure_debut").in("id", creneauIds)
      : { data: [] as { id: string; heure_debut: string }[] };
  const creneauHeureById = new Map((creneauxRaw ?? []).map((c) => [c.id, c.heure_debut]));

  function effectiveHeure(e: Row): string | null {
    if (e.creneau_id && creneauHeureById.has(e.creneau_id)) return creneauHeureById.get(e.creneau_id)!;
    return e.heure;
  }

  // Ordre de passage : par date, puis par heure de créneau/rendez-vous.
  const sorted = [...essayages].sort((a, b) => {
    const dateCompare = (a.date ?? "").localeCompare(b.date ?? "");
    if (dateCompare !== 0) return dateCompare;
    return (effectiveHeure(a) ?? "").localeCompare(effectiveHeure(b) ?? "");
  });

  const figurantIds = sorted.map((e) => e.figurants?.id).filter((id): id is string => !!id);
  const photosByFigurant = await getPhotosByFigurantId(figurantIds);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/essayages" className="print-hide text-sm text-text-muted hover:text-coral">
        ← Retour aux essayages
      </Link>

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Suivi des essayages — fiches mensuration</h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`suivi-essayages-${projet_id}.pdf`} orientation="landscape" />
          <PrintButton />
        </div>
      </div>

      {sorted.length === 0 && (
        <PrintSheet orientation="landscape">
          <DocumentLetterhead
            societe={projet?.societe_production ?? null}
            filmNom={projet?.nom ?? ""}
            dateLabel="Suivi des essayages"
            realisateur={projet?.realisateur}
          />
          <p className="py-6 text-center text-gray-500">Aucun essayage fait pour l&apos;instant.</p>
        </PrintSheet>
      )}

      {sorted.map((e) => {
        const f = e.figurants;
        if (!f) return null;
        const photos = pickFichePhotos(photosByFigurant.get(f.id));
        const heure = effectiveHeure(e);

        return (
          <PrintSheet key={e.id} orientation="landscape">
            <div className="break-after-page">
              <DocumentLetterhead
                societe={projet?.societe_production ?? null}
                filmNom={projet?.nom ?? ""}
                dateLabel={e.date ? formatDateShort(e.date) : "Date non renseignée"}
                realisateur={projet?.realisateur}
              />
              <MensurationSheet
                figurant={f}
                photos={photos}
                numeroCostume={e.numero_costume}
                header={
                  <p className="mt-0.5 text-sm text-gray-600">
                    {heure ? `Essayage à ${heureLabel(heure)}` : "Heure non renseignée"}
                    {e.lieu ? ` · ${e.lieu}` : ""}
                  </p>
                }
              />
            </div>
          </PrintSheet>
        );
      })}
    </div>
  );
}
