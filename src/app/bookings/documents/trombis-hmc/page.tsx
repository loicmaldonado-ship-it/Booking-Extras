import { createAdminClient } from "@/lib/supabase/admin";
import { getConfirmedBookings, getPhotosByFigurantId } from "@/lib/documents/data";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { FieldsToggle } from "@/components/documents/fields-toggle";
import { TrombiGrid } from "@/components/documents/trombi-grid";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { getDocumentTemplate } from "@/lib/documents/templates";
import { BackToJournee } from "@/components/documents/back-to-journee";
import { parseFields, parseIds, type DocumentField } from "@/lib/documents/fields";
import { buildFixedOrderTrombiItems, type TrombiItem } from "@/lib/documents/trombi";
import { formatDateLong } from "@/lib/format-date";
import { requireProjetAccess } from "@/lib/auth/session";

// Trombi de préparation HMC (habillage/maquillage/coiffure) : triage fixe
// par heure de convocation puis cachet puis fonction (pas de tri manuel —
// c'est l'ordre de passage attendu par l'équipe HMC), avec 3 cases à cocher
// par profil pour pointer le passage de chacun.
const DEFAULT_FIELDS: DocumentField[] = ["fonction", "sexe", "age"];
const PHOTOS_PER_PAGE = 18;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function TrombisHmcPage({
  searchParams,
}: {
  searchParams: Promise<{
    projet_id?: string;
    date?: string;
    fields?: string | string[];
    booking_ids?: string;
  }>;
}) {
  const { projet_id, date, fields, booking_ids } = await searchParams;
  await requireProjetAccess(projet_id);

  if (!projet_id || !date) {
    return <p className="text-text-muted">Choisis un projet et une date.</p>;
  }

  const selectedFields = fields === undefined ? new Set(DEFAULT_FIELDS) : parseFields(fields);
  const selectedIds = parseIds(booking_ids);

  const supabase = createAdminClient();
  const [{ data: projet }, allBookings] = await Promise.all([
    supabase.from("projets").select("nom, realisateur, societe_production").eq("id", projet_id).single(),
    getConfirmedBookings(projet_id, date),
  ]);

  const bookings = selectedIds ? allBookings.filter((b) => selectedIds.has(b.id)) : allBookings;
  const documentTemplate = await getDocumentTemplate(supabase, projet_id);

  const photosByFigurant = await getPhotosByFigurantId(bookings.map((b) => b.figurant.id));
  const items: TrombiItem[] = buildFixedOrderTrombiItems(bookings);
  const pages = chunk(items, PHOTOS_PER_PAGE);

  return (
    <div className="flex flex-col gap-4">
      <BackToJournee projetId={projet_id} date={date} />

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trombi HMC</h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`trombi-hmc-${date}.pdf`} orientation="landscape" />
          <PrintButton />
        </div>
      </div>

      <FieldsToggle
        projetId={projet_id}
        date={date}
        selected={selectedFields}
        extraHidden={{ booking_ids }}
      />

      {pages.length === 0 && (
        <PrintSheet orientation="landscape">
          <DocumentLetterhead
            societe={projet?.societe_production ?? null}
            filmNom={projet?.nom ?? ""}
            dateLabel={formatDateLong(date)}
            realisateur={projet?.realisateur}
            logoUrl={documentTemplate.logoUrl}
            accentColor={documentTemplate.accentColor}
          />
          <p className="py-6 text-center text-gray-500">Aucun booking confirmé pour cette journée.</p>
        </PrintSheet>
      )}

      {pages.map((page, pageIndex) => (
        <PrintSheet
          key={pageIndex}
          orientation="landscape"
          fixedHeight
          className="break-after-page print:break-after-page"
        >
          <DocumentLetterhead
            societe={projet?.societe_production ?? null}
            filmNom={projet?.nom ?? ""}
            dateLabel={formatDateLong(date)}
            realisateur={projet?.realisateur}
            logoUrl={documentTemplate.logoUrl}
            accentColor={documentTemplate.accentColor}
          />

          <TrombiGrid
            items={page}
            selectedFields={selectedFields}
            photosByFigurant={photosByFigurant}
            projetId={projet_id}
            showHmc
          />
        </PrintSheet>
      ))}
    </div>
  );
}
