import { createAdminClient } from "@/lib/supabase/admin";
import { getConfirmedBookings } from "@/lib/documents/data";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { BackToJournee } from "@/components/documents/back-to-journee";
import { formatHeureConvocation } from "@/lib/documents/fields";
import { formatDateLong } from "@/lib/format-date";
import { formatMajorationValeur, type BaremeCachet, type BaremeMajoration } from "@/lib/bareme/types";
import { requireProjetAccess } from "@/lib/auth/session";

const ROWS_PER_PAGE = 16;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const OPTIONAL_COLUMNS = [
  { key: "re", label: "RE" },
  { key: "majorations", label: "Majorations / Indemnités" },
  { key: "repas", label: "Repas" },
] as const;

type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number]["key"];

function parseColumns(raw: string | string[] | undefined): Set<OptionalColumn> {
  if (raw === undefined) return new Set(OPTIONAL_COLUMNS.map((c) => c.key));
  const list = Array.isArray(raw) ? raw : [raw];
  const valid = new Set(OPTIONAL_COLUMNS.map((c) => c.key));
  return new Set(list.filter((c): c is OptionalColumn => valid.has(c as OptionalColumn)));
}

export default async function BordereauPage({
  searchParams,
}: {
  searchParams: Promise<{ projet_id?: string; date?: string; colonnes?: string | string[] }>;
}) {
  const { projet_id, date, colonnes } = await searchParams;
  await requireProjetAccess(projet_id);

  if (!projet_id || !date) {
    return <p className="text-text-muted">Choisis un projet et une date.</p>;
  }

  const selectedColumns = parseColumns(colonnes);

  const supabase = createAdminClient();
  const [{ data: projet }, bookings] = await Promise.all([
    supabase.from("projets").select("nom, convention, realisateur, societe_production").eq("id", projet_id).single(),
    getConfirmedBookings(projet_id, date),
  ]);

  const convention = projet?.convention ?? null;
  const figurantIds = bookings.map((b) => b.figurant.id);
  const bookingIds = bookings.map((b) => b.id);
  const [{ data: cachetsBareme }, { data: majorationsBareme }, { data: essaisFaits }, { data: indemnitesRaw }, { data: bookingMajorationsRaw }] = await Promise.all([
    convention
      ? supabase.from("bareme_cachets").select("*").eq("convention", convention).returns<BaremeCachet[]>()
      : Promise.resolve({ data: [] as BaremeCachet[] }),
    convention
      ? supabase.from("bareme_majorations").select("*").eq("convention", convention).returns<BaremeMajoration[]>()
      : Promise.resolve({ data: [] as BaremeMajoration[] }),
    figurantIds.length > 0
      ? supabase
          .from("essayages")
          .select("figurant_id")
          .eq("projet_id", projet_id)
          .eq("statut", "fait")
          .in("figurant_id", figurantIds)
      : Promise.resolve({ data: [] as { figurant_id: string }[] }),
    bookingIds.length > 0
      ? supabase
          .from("booking_indemnites")
          .select("booking_id, projet_indemnites(label, montant)")
          .in("booking_id", bookingIds)
          .returns<{ booking_id: string; projet_indemnites: { label: string; montant: number } | null }[]>()
      : Promise.resolve({ data: [] as { booking_id: string; projet_indemnites: { label: string; montant: number } | null }[] }),
    bookingIds.length > 0
      ? supabase
          .from("booking_majorations")
          .select("booking_id, bareme_majorations(label, valeur_type, valeur)")
          .in("booking_id", bookingIds)
          .returns<
            { booking_id: string; bareme_majorations: Pick<BaremeMajoration, "label" | "valeur_type" | "valeur"> | null }[]
          >()
      : Promise.resolve({
          data: [] as { booking_id: string; bareme_majorations: Pick<BaremeMajoration, "label" | "valeur_type" | "valeur"> | null }[],
        }),
  ]);

  const figurantsAvecEssai = new Set((essaisFaits ?? []).map((e) => e.figurant_id));
  const essayageIndemnite = (majorationsBareme ?? []).find((m) => m.type === "essayage");

  const indemnitesByBooking = new Map<string, { label: string; montant: number }[]>();
  for (const bi of indemnitesRaw ?? []) {
    if (!bi.projet_indemnites) continue;
    const list = indemnitesByBooking.get(bi.booking_id) ?? [];
    list.push(bi.projet_indemnites);
    indemnitesByBooking.set(bi.booking_id, list);
  }

  const majorationsByBooking = new Map<string, Pick<BaremeMajoration, "label" | "valeur_type" | "valeur">[]>();
  for (const bm of bookingMajorationsRaw ?? []) {
    if (!bm.bareme_majorations) continue;
    const list = majorationsByBooking.get(bm.booking_id) ?? [];
    list.push(bm.bareme_majorations);
    majorationsByBooking.set(bm.booking_id, list);
  }

  function montantForCachet(cachet: string | null) {
    if (!cachet || !cachetsBareme) return null;
    return cachetsBareme.find((c) => c.cachet === cachet)?.montant_brut ?? null;
  }

  return (
    <div className="flex flex-col gap-4">
      <BackToJournee projetId={projet_id} date={date} />

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Bordereau d&apos;émargement</h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`bordereau-${date}.pdf`} orientation="landscape" />
          <PrintButton />
        </div>
      </div>

      <form
        method="get"
        className="print-hide flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-ink-raised px-4 py-3 text-sm"
      >
        <input type="hidden" name="projet_id" value={projet_id} />
        <input type="hidden" name="date" value={date} />
        <span className="text-text-muted">Colonnes :</span>
        {OPTIONAL_COLUMNS.map((c) => (
          <label key={c.key} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              name="colonnes"
              value={c.key}
              defaultChecked={selectedColumns.has(c.key)}
              className="h-4 w-4 rounded border-border accent-coral"
            />
            {c.label}
          </label>
        ))}
        <button
          type="submit"
          className="rounded-full bg-ink-raised-2 px-4 py-1.5 text-sm font-medium hover:border hover:border-coral/60"
        >
          Appliquer
        </button>
      </form>

      {chunk(bookings, ROWS_PER_PAGE).map((page, pageIndex, allPages) => (
        <PrintSheet key={pageIndex} orientation="landscape" className="break-after-page print:break-after-page">
          <DocumentLetterhead
            societe={projet?.societe_production ?? null}
            filmNom={projet?.nom ?? ""}
            dateLabel={
              allPages.length > 1 ? `${formatDateLong(date)} · Page ${pageIndex + 1}/${allPages.length}` : formatDateLong(date)
            }
            realisateur={projet?.realisateur}
          />

          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="border border-black px-2 py-2">Nb</th>
                <th className="border border-black px-2 py-2">R</th>
                <th className="border border-black px-2 py-2">Noms Prénoms</th>
                <th className="border border-black px-2 py-2">Cachets</th>
                {selectedColumns.has("re") && <th className="border border-black px-2 py-2">RE</th>}
                <th className="border border-black px-2 py-2">Signatures arrivées</th>
                {selectedColumns.has("majorations") && (
                  <th className="border border-black px-2 py-2">Majorations Indemnités</th>
                )}
                {selectedColumns.has("repas") && <th className="border border-black px-2 py-2">Repas</th>}
                <th className="border border-black px-2 py-2">Heure arrivée</th>
                <th className="border border-black px-2 py-2">Heure départ</th>
                <th className="border border-black px-2 py-2">Signatures départs</th>
              </tr>
            </thead>
            <tbody>
              {page.map((b, i) => {
                const montant = montantForCachet(b.cachet);
                return (
                  <tr key={b.id}>
                    <td className="border border-black px-2 py-3">{pageIndex * ROWS_PER_PAGE + i + 1}</td>
                    <td className="border border-black px-2 py-3"></td>
                    <td className="border border-black px-2 py-3 font-medium">
                      {b.figurant.nom} {b.figurant.prenom}
                    </td>
                    <td className="border border-black px-2 py-3">
                      {montant !== null ? `${Math.round(montant)} €` : "—"}
                    </td>
                    {selectedColumns.has("re") && (
                      <td className="border border-black px-2 py-3 text-gray-500">Non</td>
                    )}
                    <td className="border border-black px-2 py-3"></td>
                    {selectedColumns.has("majorations") && (
                      <td className="border border-black px-2 py-3 text-gray-500">
                        {figurantsAvecEssai.has(b.figurant.id) && essayageIndemnite?.valeur != null && (
                          <div>Essayage {essayageIndemnite.valeur.toFixed(2)} €</div>
                        )}
                        {(indemnitesByBooking.get(b.id) ?? []).map((ind, i) => (
                          <div key={i}>
                            {ind.label} {ind.montant.toFixed(2)} €
                          </div>
                        ))}
                        {(majorationsByBooking.get(b.id) ?? []).map((m, i) => (
                          <div key={i}>
                            {m.label} {formatMajorationValeur(m)}
                          </div>
                        ))}
                      </td>
                    )}
                    {selectedColumns.has("repas") && <td className="border border-black px-2 py-3"></td>}
                    <td className="border border-black px-2 py-3">
                      {b.heure_convocation ? formatHeureConvocation(b.heure_convocation) : "—"}
                    </td>
                    <td className="border border-black px-2 py-3"></td>
                    <td className="border border-black px-2 py-3"></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PrintSheet>
      ))}
      {bookings.length === 0 && (
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
    </div>
  );
}
