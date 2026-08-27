import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfirmedBookings, getCovoiturageByFigurant, getPhotosByFigurantId } from "@/lib/documents/data";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { FieldsToggle } from "@/components/documents/fields-toggle";
import { TrombiGrid } from "@/components/documents/trombi-grid";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { getDocumentTemplate } from "@/lib/documents/templates";
import { BackToJournee } from "@/components/documents/back-to-journee";
import { parseFields, parseIds, type DocumentField } from "@/lib/documents/fields";
import {
  buildCovoiturageTrombiItems,
  groupItemsByHeader,
  paginateGroupedItems,
  type TrombiItem,
} from "@/lib/documents/trombi";
import { formatDateLong } from "@/lib/format-date";
import { requireProjetAccess } from "@/lib/auth/session";
import { cn } from "@/lib/cn";

// Ville/téléphone par défaut : l'essentiel pour organiser un covoiturage
// (où habite chacun·e, comment les joindre) sans avoir à ouvrir la fiche.
const DEFAULT_FIELDS: DocumentField[] = ["ville", "telephone"];

export default async function CovoiturageDocPage({
  searchParams,
}: {
  searchParams: Promise<{
    projet_id?: string;
    date?: string;
    fields?: string | string[];
    booking_ids?: string;
    vue?: string;
  }>;
}) {
  const { projet_id, date, fields, booking_ids, vue } = await searchParams;
  await requireProjetAccess(projet_id);

  if (!projet_id || !date) {
    return <p className="text-text-muted">Choisis un projet et une date.</p>;
  }

  const isListe = vue === "liste";
  const selectedFields = fields === undefined ? new Set(DEFAULT_FIELDS) : parseFields(fields);
  const selectedIds = parseIds(booking_ids);

  const supabase = createAdminClient();
  const [{ data: projet }, allBookings, covoiturageByFigurant] = await Promise.all([
    supabase
      .from("projets")
      .select("nom, realisateur, societe_production, covoiturage_tarif_base, covoiturage_tarif_passager")
      .eq("id", projet_id)
      .single(),
    getConfirmedBookings(projet_id, date),
    getCovoiturageByFigurant(projet_id, date),
  ]);

  const bookings = selectedIds ? allBookings.filter((b) => selectedIds.has(b.id)) : allBookings;
  const documentTemplate = await getDocumentTemplate(supabase, projet_id);

  const items: TrombiItem[] = buildCovoiturageTrombiItems(
    bookings,
    covoiturageByFigurant,
    projet?.covoiturage_tarif_base ?? 15,
    projet?.covoiturage_tarif_passager ?? 5
  );

  const baseQuery = `?projet_id=${projet_id}&date=${date}`;

  return (
    <div className="flex flex-col gap-4">
      <BackToJournee projetId={projet_id} date={date} />

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{isListe ? "Liste covoiturage" : "Trombi covoiturage"}</h1>
        <div className="flex gap-3">
          <DownloadPdfButton
            filename={isListe ? `covoiturage-liste-${date}.pdf` : `covoiturage-${date}.pdf`}
            orientation={isListe ? "portrait" : "landscape"}
          />
          <PrintButton />
        </div>
      </div>

      <div className="print-hide flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-text-muted">Vue :</span>
        <Link
          href={`/bookings/documents/covoiturage${baseQuery}`}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            !isListe ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
          )}
        >
          Trombi (photos)
        </Link>
        <Link
          href={`/bookings/documents/covoiturage${baseQuery}&vue=liste`}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            isListe ? "border-coral bg-coral/15 text-coral" : "border-border text-text-muted hover:text-text"
          )}
        >
          Liste (texte)
        </Link>
      </div>

      {isListe ? (
        <ListeCovoiturage
          items={items}
          projetNom={projet?.nom ?? ""}
          societe={projet?.societe_production ?? null}
          realisateur={projet?.realisateur}
          dateLabel={formatDateLong(date)}
          logoUrl={documentTemplate.logoUrl}
          accentColor={documentTemplate.accentColor}
        />
      ) : (
        <TrombiCovoiturage
          items={items}
          bookings={bookings}
          projetId={projet_id}
          projetNom={projet?.nom ?? ""}
          societe={projet?.societe_production ?? null}
          realisateur={projet?.realisateur}
          dateLabel={formatDateLong(date)}
          logoUrl={documentTemplate.logoUrl}
          accentColor={documentTemplate.accentColor}
          selectedFields={selectedFields}
          date={date}
          bookingIds={booking_ids}
        />
      )}
    </div>
  );
}

async function TrombiCovoiturage({
  items,
  bookings,
  projetId,
  projetNom,
  societe,
  realisateur,
  dateLabel,
  logoUrl,
  accentColor,
  selectedFields,
  date,
  bookingIds,
}: {
  items: TrombiItem[];
  bookings: Awaited<ReturnType<typeof getConfirmedBookings>>;
  projetId: string;
  projetNom: string;
  societe: string | null;
  realisateur: string | null | undefined;
  dateLabel: string;
  logoUrl: string | null;
  accentColor: string | null;
  selectedFields: Set<DocumentField>;
  date: string;
  bookingIds: string | undefined;
}) {
  const photosByFigurant = await getPhotosByFigurantId(bookings.map((b) => b.figurant.id));
  const pages = paginateGroupedItems(items, (i) => i.headerLabel);

  return (
    <>
      <FieldsToggle
        projetId={projetId}
        date={date}
        selected={selectedFields}
        extraHidden={{ booking_ids: bookingIds }}
      />

      {pages.length === 0 && (
        <PrintSheet orientation="landscape">
          <DocumentLetterhead
            societe={societe}
            filmNom={projetNom}
            dateLabel={dateLabel}
            realisateur={realisateur}
            logoUrl={logoUrl}
            accentColor={accentColor}
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
          pageLabel={pages.length > 1 ? `${pageIndex + 1} / ${pages.length}` : undefined}
        >
          <DocumentLetterhead
            societe={societe}
            filmNom={projetNom}
            dateLabel={dateLabel}
            realisateur={realisateur}
            logoUrl={logoUrl}
            accentColor={accentColor}
          />

          <TrombiGrid items={page} selectedFields={selectedFields} photosByFigurant={photosByFigurant} projetId={projetId} />
        </PrintSheet>
      ))}
    </>
  );
}

function ListeCovoiturage({
  items,
  projetNom,
  societe,
  realisateur,
  dateLabel,
  logoUrl,
  accentColor,
}: {
  items: TrombiItem[];
  projetNom: string;
  societe: string | null;
  realisateur: string | null | undefined;
  dateLabel: string;
  logoUrl: string | null;
  accentColor: string | null;
}) {
  const blocks = groupItemsByHeader(items);

  return (
    <PrintSheet>
      <DocumentLetterhead
        societe={societe}
        filmNom={projetNom}
        dateLabel={dateLabel}
        realisateur={realisateur}
        logoUrl={logoUrl}
        accentColor={accentColor}
      />

      {blocks.length === 0 && <p className="py-6 text-center text-gray-500">Aucun booking confirmé pour cette journée.</p>}

      <div className="mt-4 flex flex-col gap-4">
        {blocks.map((b) => {
          const isConducteur = b.items[0]?.badge === "🚗";
          const autres = isConducteur ? b.items.slice(1) : b.items;
          const nomEt = (i: TrombiItem) =>
            `${i.booking.figurant.prenom} ${i.booking.figurant.nom}${i.booking.figurant.telephone ? ` (${i.booking.figurant.telephone})` : ""}`;

          return (
            <div key={b.headerLabel} className={isConducteur ? "rounded border border-gray-400 p-3" : ""}>
              <p className="text-sm font-semibold">{b.headerLabel}</p>
              {isConducteur ? (
                <p className="mt-1 text-sm">
                  Passagers ({autres.length}) : {autres.length === 0 ? "aucun" : autres.map(nomEt).join(", ")}
                </p>
              ) : (
                <p className="text-sm text-gray-700">{autres.map(nomEt).join(", ")}</p>
              )}
            </div>
          );
        })}
      </div>
    </PrintSheet>
  );
}
