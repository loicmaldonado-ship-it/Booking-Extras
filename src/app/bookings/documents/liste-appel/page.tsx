import { createAdminClient } from "@/lib/supabase/admin";
import { getConfirmedBookings } from "@/lib/documents/data";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { FieldsToggle } from "@/components/documents/fields-toggle";
import { BackToJournee } from "@/components/documents/back-to-journee";
import { computeAge, parseFields } from "@/lib/documents/fields";
import { sortBookingsFlat, parseDocSort, DOC_SORT_OPTIONS } from "@/lib/documents/sort";
import { formatDateShort } from "@/lib/format-date";

const ROWS_PER_PAGE = 28;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default async function ListeAppelPage({
  searchParams,
}: {
  searchParams: Promise<{ projet_id?: string; date?: string; fields?: string | string[]; sort?: string }>;
}) {
  const { projet_id, date, fields, sort } = await searchParams;

  if (!projet_id || !date) {
    return <p className="text-text-muted">Choisis un projet et une date.</p>;
  }

  const selectedFields = parseFields(fields);
  const docSort = parseDocSort(sort);

  const supabase = createAdminClient();
  const [{ data: projet }, allBookings] = await Promise.all([
    supabase.from("projets").select("nom").eq("id", projet_id).single(),
    getConfirmedBookings(projet_id, date),
  ]);

  const bookings = sortBookingsFlat(allBookings, docSort);

  return (
    <div className="flex flex-col gap-4">
      <BackToJournee projetId={projet_id} date={date} />

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Liste d&apos;appel</h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`liste-appel-${date}.pdf`} orientation="portrait" />
          <PrintButton />
        </div>
      </div>

      <FieldsToggle
        projetId={projet_id}
        date={date}
        selected={selectedFields}
        groupBy={{ options: DOC_SORT_OPTIONS, value: docSort, paramName: "sort" }}
      />

      {chunk(bookings, ROWS_PER_PAGE).map((page, pageIndex, allPages) => (
        <PrintSheet key={pageIndex} className="break-after-page print:break-after-page">
          <h2 className="text-xl font-bold">Liste d&apos;appel — {projet?.nom}</h2>
          <p className="mb-4 text-sm text-gray-600">
            {formatDateShort(date)}
            {allPages.length > 1 ? ` · Page ${pageIndex + 1}/${allPages.length}` : ""}
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-2 pr-4">Heure</th>
                <th className="py-2 pr-4">Nom</th>
                <th className="py-2 pr-4">Prénom</th>
                {selectedFields.has("fonction") && <th className="py-2 pr-4">Fonction</th>}
                {selectedFields.has("age") && <th className="py-2 pr-4">Âge</th>}
                <th className="py-2 pr-4">Téléphone</th>
                <th className="py-2 pr-4">Email</th>
                {selectedFields.has("ville") && <th className="py-2 pr-4">Ville</th>}
              </tr>
            </thead>
            <tbody>
              {page.map((b) => {
                const age = computeAge(b.figurant.date_naissance);
                return (
                  <tr key={b.id} className="border-b border-gray-300">
                    <td className="py-2 pr-4">{b.heure_convocation ?? "—"}</td>
                    <td className="py-2 pr-4 font-medium">{b.figurant.nom}</td>
                    <td className="py-2 pr-4">{b.figurant.prenom}</td>
                    {selectedFields.has("fonction") && <td className="py-2 pr-4">{b.fonction ?? "—"}</td>}
                    {selectedFields.has("age") && <td className="py-2 pr-4">{age ?? "—"}</td>}
                    <td className="py-2 pr-4">{b.figurant.telephone ?? "—"}</td>
                    <td className="py-2 pr-4">{b.figurant.email ?? "—"}</td>
                    {selectedFields.has("ville") && <td className="py-2 pr-4">{b.figurant.ville ?? "—"}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PrintSheet>
      ))}
      {bookings.length === 0 && (
        <PrintSheet>
          <h2 className="text-xl font-bold">Liste d&apos;appel — {projet?.nom}</h2>
          <p className="mb-4 text-sm text-gray-600">{formatDateShort(date)}</p>
          <p className="py-6 text-center text-gray-500">Aucun booking confirmé pour cette journée.</p>
        </PrintSheet>
      )}
    </div>
  );
}
