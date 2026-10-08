import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFutureBookingsByFigurant, pickFichePhotos } from "@/lib/documents/data";
import { getCandidaturesPourDocuments, getPhotosDesCandidatures } from "@/lib/candidatures/documents";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { FieldsToggle } from "@/components/documents/fields-toggle";
import { SortChips } from "@/components/documents/sort-chips";
import { MensurationSheet } from "@/components/documents/mensuration-sheet";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { getDocumentTemplate } from "@/lib/documents/templates";
import { computeAge, parseFields, parseIds, type DocumentField } from "@/lib/documents/fields";
import { sortBookingsFlat, parseDocSort } from "@/lib/documents/sort";
import { formatDayMonth } from "@/lib/format-date";
import { requireProjetAccess } from "@/lib/auth/session";

// Muette par défaut, comme les fiches d'une journée : ni téléphone ni email
// tant qu'on ne les ajoute pas explicitement.
const DEFAULT_FIELDS: DocumentField[] = ["fonction", "ville"];

// Fiches mensuration d'une sélection de candidatures (page Candidatures),
// avant tout booking — même fiche que pour une journée, avec les jours où
// la personne s'est dite disponible.
export default async function CandidaturesFichesPage({
  searchParams,
}: {
  searchParams: Promise<{ annonce_id?: string; ids?: string; fields?: string | string[]; sort?: string | string[] }>;
}) {
  const { annonce_id, ids, fields, sort } = await searchParams;
  if (!annonce_id) return <p className="text-text-muted">Choisis une annonce.</p>;

  const data = await getCandidaturesPourDocuments(annonce_id, parseIds(ids));
  if (!data) return <p className="text-text-muted">Annonce introuvable.</p>;
  await requireProjetAccess(data.annonce.projet_id);

  const projetId = data.annonce.projet_id;
  const selectedFields = fields === undefined ? new Set(DEFAULT_FIELDS) : parseFields(fields);
  const docSort = parseDocSort(sort);
  const items = sortBookingsFlat(data.items, docSort);
  const figurantIds = items.map((b) => b.figurant.id);
  const today = new Date().toISOString().slice(0, 10);

  const supabase = createAdminClient();
  const [{ data: projet }, documentTemplate, photosByFigurant, futureBookingsByFigurant, { data: costumesRaw }] =
    await Promise.all([
      supabase.from("projets").select("nom, realisateur, societe_production").eq("id", projetId).single(),
      getDocumentTemplate(supabase, projetId),
      getPhotosDesCandidatures(items),
      getFutureBookingsByFigurant(figurantIds, today),
      figurantIds.length > 0
        ? supabase
            .from("essayages")
            .select("figurant_id, numero_costume")
            .eq("projet_id", projetId)
            .not("numero_costume", "is", null)
            .in("figurant_id", figurantIds)
        : Promise.resolve({ data: [] as { figurant_id: string; numero_costume: string }[] }),
    ]);
  const numeroCostumeByFigurant = new Map((costumesRaw ?? []).map((c) => [c.figurant_id, c.numero_costume]));

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/candidatures?annonce_id=${annonce_id}`}
        className="print-hide inline-flex items-center gap-1 text-sm text-text-muted hover:text-coral"
      >
        ← Retour aux candidatures
      </Link>

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Fiches mensuration · {items.length} candidature{items.length > 1 ? "s" : ""}
        </h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename="fiches-mensuration-candidatures.pdf" orientation="landscape" />
          <PrintButton />
        </div>
      </div>

      <SortChips baseParams={{ annonce_id, ids, fields }} current={docSort} />
      <FieldsToggle
        projetId={projetId}
        date=""
        selected={selectedFields}
        excludeFields={["sexe"]}
        extraHidden={{ annonce_id, ids, sort: docSort }}
      />

      {items.length === 0 && (
        <PrintSheet orientation="landscape">
          <p className="py-6 text-center text-gray-500">Aucune candidature sélectionnée.</p>
        </PrintSheet>
      )}

      {items.map((b) => {
        const f = b.figurant;
        const age = computeAge(f.date_naissance);
        const coordonnees = [
          selectedFields.has("telephone") ? f.telephone : null,
          selectedFields.has("email") ? f.email : null,
          selectedFields.has("ville") ? f.ville : null,
          selectedFields.has("age") && age !== null ? `${age} ans` : null,
        ].filter(Boolean);
        const dispos = data.joursDispo.get(b.id) ?? [];

        return (
          <PrintSheet key={b.id} orientation="landscape">
            <div className="break-after-page">
              <DocumentLetterhead
                societe={projet?.societe_production ?? null}
                filmNom={projet?.nom ?? ""}
                dateLabel={`Candidatures · ${data.annonce.titre}`}
                realisateur={projet?.realisateur}
                logoUrl={documentTemplate.logoUrl}
                accentColor={documentTemplate.accentColor}
              />
              <MensurationSheet
                figurant={f}
                photos={pickFichePhotos(photosByFigurant.get(f.id), projetId)}
                header={
                  <>
                    {selectedFields.has("fonction") && b.fonction && (
                      <p className="mt-0.5 text-sm text-gray-600">{b.fonction}</p>
                    )}
                    {coordonnees.length > 0 && <p className="text-sm text-gray-600">{coordonnees.join(" · ")}</p>}
                  </>
                }
                extraRows={[
                  ["Cachet", b.cachet ?? "—"],
                  ["Disponible", dispos.length > 0 ? dispos.map(formatDayMonth).join(", ") : "—"],
                ]}
                futureBookings={futureBookingsByFigurant.get(f.id) ?? []}
                numeroCostume={numeroCostumeByFigurant.get(f.id) ?? null}
              />
            </div>
          </PrintSheet>
        );
      })}
    </div>
  );
}
