import { createAdminClient } from "@/lib/supabase/admin";
import { getConfirmedBookings, getPhotosByFigurantId } from "@/lib/documents/data";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { FieldsToggle } from "@/components/documents/fields-toggle";
import { SortChips } from "@/components/documents/sort-chips";
import { TrombiGrid } from "@/components/documents/trombi-grid";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { getDocumentTemplate } from "@/lib/documents/templates";
import { BackToJournee } from "@/components/documents/back-to-journee";
import { parseFields, parseIds } from "@/lib/documents/fields";
import { parseDocSort } from "@/lib/documents/sort";
import { buildTrombiItems, paginateGroupedItems, type TrombiItem } from "@/lib/documents/trombi";
import { formatDateLong } from "@/lib/format-date";
import { requireProjetAccess } from "@/lib/auth/session";

export default async function TrombisPage({
  searchParams,
}: {
  searchParams: Promise<{
    projet_id?: string;
    date?: string;
    fields?: string | string[];
    booking_ids?: string;
    sort?: string | string[];
  }>;
}) {
  const { projet_id, date, fields, booking_ids, sort } = await searchParams;
  await requireProjetAccess(projet_id);

  if (!projet_id || !date) {
    return <p className="text-text-muted">Choisis un projet et une date.</p>;
  }

  const selectedFields = parseFields(fields);
  const selectedIds = parseIds(booking_ids);
  const docSort = parseDocSort(sort);

  const supabase = createAdminClient();
  const [{ data: projet }, allBookings] = await Promise.all([
    supabase.from("projets").select("nom, realisateur, societe_production").eq("id", projet_id).single(),
    getConfirmedBookings(projet_id, date),
  ]);

  const bookings = selectedIds ? allBookings.filter((b) => selectedIds.has(b.id)) : allBookings;
  const documentTemplate = await getDocumentTemplate(supabase, projet_id);

  const photosByFigurant = await getPhotosByFigurantId(bookings.map((b) => b.figurant.id));
  const items: TrombiItem[] = buildTrombiItems(bookings, docSort);
  const pages = paginateGroupedItems(items, (i) => i.headerLabel);

  return (
    <div className="flex flex-col gap-4">
      <BackToJournee projetId={projet_id} date={date} />

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trombis</h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`trombis-${date}.pdf`} orientation="landscape" />
          <PrintButton />
        </div>
      </div>

      <SortChips
        baseParams={{ projet_id, date, fields, booking_ids }}
        current={docSort}
      />

      <FieldsToggle
        projetId={projet_id}
        date={date}
        selected={selectedFields}
        extraHidden={{ booking_ids, sort: docSort }}
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

          <TrombiGrid items={page} selectedFields={selectedFields} photosByFigurant={photosByFigurant} projetId={projet_id} />
        </PrintSheet>
      ))}
    </div>
  );
}
