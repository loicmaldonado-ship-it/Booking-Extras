import { createAdminClient } from "@/lib/supabase/admin";
import {
  getConfirmedBookings,
  getFutureBookingsByFigurant,
  getPhotosByFigurantId,
  pickFichePhotos,
} from "@/lib/documents/data";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { FieldsToggle } from "@/components/documents/fields-toggle";
import { MensurationSheet } from "@/components/documents/mensuration-sheet";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { BackToJournee } from "@/components/documents/back-to-journee";
import { computeAge, parseFields, parseIds, formatHeureConvocation, type DocumentField } from "@/lib/documents/fields";
import { sortBookingsFlat, parseDocSort, DOC_SORT_OPTIONS } from "@/lib/documents/sort";
import { formatDateShort, formatDateLong } from "@/lib/format-date";
import { requireProjetAccess } from "@/lib/auth/session";

// Muette par défaut : ni téléphone ni email tant qu'on ne les ajoute pas
// explicitement (voir FieldsToggle) — le cachet, lui, est toujours affiché.
const DEFAULT_FIELDS: DocumentField[] = ["fonction", "ville"];

export default async function FichesPage({
  searchParams,
}: {
  searchParams: Promise<{
    projet_id?: string;
    date?: string;
    fields?: string | string[];
    booking_ids?: string;
    sort?: string;
  }>;
}) {
  const { projet_id, date, fields, booking_ids, sort } = await searchParams;
  await requireProjetAccess(projet_id);

  if (!projet_id || !date) {
    return <p className="text-text-muted">Choisis un projet et une date.</p>;
  }

  const selectedFields = fields === undefined ? new Set(DEFAULT_FIELDS) : parseFields(fields);
  const selectedIds = parseIds(booking_ids);
  const docSort = parseDocSort(sort);

  const supabase = createAdminClient();
  const [{ data: projet }, allBookings] = await Promise.all([
    supabase.from("projets").select("nom, realisateur, societe_production").eq("id", projet_id).single(),
    getConfirmedBookings(projet_id, date),
  ]);

  const bookings = sortBookingsFlat(
    selectedIds ? allBookings.filter((b) => selectedIds.has(b.id)) : allBookings,
    docSort
  );

  const figurantIds = bookings.map((b) => b.figurant.id);
  const today = new Date().toISOString().slice(0, 10);
  const [photosByFigurant, futureBookingsByFigurant, { data: costumesRaw }] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    getFutureBookingsByFigurant(figurantIds, today),
    figurantIds.length > 0
      ? supabase
          .from("essayages")
          .select("figurant_id, numero_costume")
          .eq("projet_id", projet_id)
          .not("numero_costume", "is", null)
          .in("figurant_id", figurantIds)
      : Promise.resolve({ data: [] as { figurant_id: string; numero_costume: string }[] }),
  ]);
  const numeroCostumeByFigurant = new Map((costumesRaw ?? []).map((c) => [c.figurant_id, c.numero_costume]));

  return (
    <div className="flex flex-col gap-4">
      <BackToJournee projetId={projet_id} date={date} />

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fiches mensuration</h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`fiches-mensuration-${date}.pdf`} orientation="landscape" />
          <PrintButton />
        </div>
      </div>

      <FieldsToggle
        projetId={projet_id}
        date={date}
        selected={selectedFields}
        groupBy={{ options: DOC_SORT_OPTIONS, value: docSort, paramName: "sort" }}
      />

      {bookings.length === 0 && (
        <PrintSheet orientation="landscape">
          <p className="py-6 text-center text-gray-500">Aucun booking confirmé pour cette journée.</p>
        </PrintSheet>
      )}

      {bookings.map((b) => {
        const f = b.figurant;
        const photos = pickFichePhotos(photosByFigurant.get(f.id), projet_id);
        const age = computeAge(f.date_naissance);
        const coordonnees = [
          selectedFields.has("telephone") ? f.telephone : null,
          selectedFields.has("email") ? f.email : null,
          selectedFields.has("ville") ? f.ville : null,
          selectedFields.has("age") && age !== null ? `${age} ans` : null,
        ].filter(Boolean);

        return (
          <PrintSheet key={b.id} orientation="landscape">
            <div className="break-after-page">
              <DocumentLetterhead
                societe={projet?.societe_production ?? null}
                filmNom={projet?.nom ?? ""}
                dateLabel={formatDateLong(date)}
                realisateur={projet?.realisateur}
              />
              <MensurationSheet
                figurant={f}
                photos={photos}
                header={
                  <>
                    <p className="mt-0.5 text-sm text-gray-600">
                      {formatDateShort(date)}
                      {selectedFields.has("fonction") && b.fonction ? ` · ${b.fonction}` : ""}
                    </p>
                    {coordonnees.length > 0 && (
                      <p className="text-sm text-gray-600">{coordonnees.join(" · ")}</p>
                    )}
                  </>
                }
                extraRows={[
                  ["Cachet", b.cachet ?? "—"],
                  ["Convocation", b.heure_convocation ? formatHeureConvocation(b.heure_convocation) : "—"],
                ]}
                futureBookings={(futureBookingsByFigurant.get(f.id) ?? []).filter((fb) => fb.id !== b.id)}
                numeroCostume={numeroCostumeByFigurant.get(f.id) ?? null}
              />
            </div>
          </PrintSheet>
        );
      })}
    </div>
  );
}
