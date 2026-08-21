import { Fragment } from "react";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { getConfirmedBookings, getPhotosByFigurantId, pickPortrait, type ConfirmedBooking } from "@/lib/documents/data";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { FieldsToggle } from "@/components/documents/fields-toggle";
import { SortChips } from "@/components/documents/sort-chips";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { BackToJournee } from "@/components/documents/back-to-journee";
import { computeAge, parseFields, parseIds, formatHeureConvocation } from "@/lib/documents/fields";
import { groupForDoc, parseDocSort } from "@/lib/documents/sort";
import { formatDateLong } from "@/lib/format-date";
import { requireProjetAccess } from "@/lib/auth/session";
// Ordre d'affichage voulu sur les trombis : silhouettes, puis doublures, puis figurants en dernier.
const TROMBI_CACHET_ORDER = [
  "Silhouette",
  "Silhouette parlante",
  "Doublure simple",
  "Doublure polyvalente",
  "Rôle",
  "Figurant",
];

const PHOTOS_PER_PAGE = 24;

type FlatItem = {
  booking: ConfirmedBooking;
  headerLabel: string;
  fonctionLabel: string;
};

function cachetOrder(cachet: string | null) {
  const idx = cachet ? TROMBI_CACHET_ORDER.indexOf(cachet) : -1;
  return idx === -1 ? TROMBI_CACHET_ORDER.length : idx;
}

function flattenByHeureEtCachet(bookings: ConfirmedBooking[], sortByFonction: boolean): FlatItem[] {
  const byHeure = new Map<string, ConfirmedBooking[]>();
  for (const b of bookings) {
    const key = b.heure_convocation ?? "";
    const list = byHeure.get(key) ?? [];
    list.push(b);
    byHeure.set(key, list);
  }

  const items: FlatItem[] = [];
  for (const [heure, group] of Array.from(byHeure.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const heureLabel = heure ? formatHeureConvocation(heure) : "Heure non renseignée";
    const byCachet = new Map<string, ConfirmedBooking[]>();
    for (const b of group) {
      const key = b.cachet ?? "Cachet non assigné";
      const list = byCachet.get(key) ?? [];
      list.push(b);
      byCachet.set(key, list);
    }
    const cachetGroups = Array.from(byCachet.entries()).sort(
      (a, b) => cachetOrder(a[1][0]?.cachet ?? null) - cachetOrder(b[1][0]?.cachet ?? null)
    );
    for (const [cachetLabel, sousGroup] of cachetGroups) {
      const nomSort = (a: ConfirmedBooking, b: ConfirmedBooking) =>
        `${a.figurant.prenom} ${a.figurant.nom}`.localeCompare(`${b.figurant.prenom} ${b.figurant.nom}`);
      const sorted = sortByFonction
        ? [...sousGroup].sort(
            (a, b) => (a.fonction ?? "").localeCompare(b.fonction ?? "") || nomSort(a, b)
          )
        : [...sousGroup].sort(nomSort);
      for (const b of sorted) {
        items.push({
          booking: b,
          headerLabel: `${heureLabel} · ${cachetLabel}`,
          fonctionLabel: b.fonction ?? "Sans fonction assignée",
        });
      }
    }
  }
  return items;
}

function flattenByCustomGroup(groups: { label: string; items: ConfirmedBooking[] }[]): FlatItem[] {
  const items: FlatItem[] = [];
  for (const g of groups) {
    for (const b of g.items) {
      items.push({
        booking: b,
        headerLabel: g.label,
        fonctionLabel: b.fonction ?? "Sans fonction assignée",
      });
    }
  }
  return items;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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

  const showFonction = selectedFields.has("fonction");
  const photosByFigurant = await getPhotosByFigurantId(bookings.map((b) => b.figurant.id));
  const customGroups = groupForDoc(bookings, docSort);
  const flatItems = customGroups ? flattenByCustomGroup(customGroups) : flattenByHeureEtCachet(bookings, showFonction);
  const pages = chunk(flatItems, PHOTOS_PER_PAGE);

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
        excludeFields={["telephone", "email"]}
        extraHidden={{ booking_ids, sort: docSort }}
      />

      {pages.length === 0 && (
        <PrintSheet orientation="landscape">
          <DocumentLetterhead
            societe={projet?.societe_production ?? null}
            filmNom={projet?.nom ?? ""}
            dateLabel={formatDateLong(date)}
            realisateur={projet?.realisateur}
          />
          <p className="py-6 text-center text-gray-500">Aucun booking confirmé pour cette journée.</p>
        </PrintSheet>
      )}

      {pages.map((page, pageIndex) => {
        let lastHeader: string | null = null;
        let lastFonction: string | null = null;

        return (
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
            />

            <div className="flex flex-wrap gap-x-3 gap-y-2">
              {page.map((item) => {
                const showHeader =
                  item.headerLabel !== lastHeader || (showFonction && item.fonctionLabel !== lastFonction);
                lastHeader = item.headerLabel;
                lastFonction = item.fonctionLabel;
                const portrait = pickPortrait(photosByFigurant.get(item.booking.figurant.id), projet_id);
                const age = computeAge(item.booking.figurant.date_naissance);

                return (
                  <Fragment key={item.booking.id}>
                    {showHeader && (
                      <div className="mt-1 w-full border-b border-gray-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 first:mt-0">
                        {item.headerLabel}
                        {showFonction && !customGroups ? ` · ${item.fonctionLabel}` : ""}
                      </div>
                    )}
                    <div className="flex w-24 flex-col items-center gap-0.5 text-center">
                      <div className="relative h-32 w-24 overflow-hidden rounded bg-gray-100">
                        {portrait?.url && (
                          <Image src={portrait.url} alt="" fill className="object-cover" unoptimized />
                        )}
                      </div>
                      <span className="text-[10px] font-medium leading-tight">
                        {item.booking.figurant.prenom} {item.booking.figurant.nom}
                      </span>
                      {showFonction && item.booking.fonction && (
                        <span className="text-[8px] italic leading-tight text-gray-500">
                          {item.booking.fonction}
                        </span>
                      )}
                      <div className="flex flex-col text-[8px] leading-tight text-gray-600">
                        {selectedFields.has("age") && age !== null && <span>{age} ans</span>}
                        {selectedFields.has("ville") && item.booking.figurant.ville && (
                          <span>{item.booking.figurant.ville}</span>
                        )}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </PrintSheet>
        );
      })}
    </div>
  );
}
