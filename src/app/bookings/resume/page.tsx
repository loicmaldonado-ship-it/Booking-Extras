import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { BackLink } from "@/components/ui/back-link";
import { Badge } from "@/components/ui/card";
import { getJournees } from "@/lib/bookings/journees";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { TROMBI_CACHET_ORDER } from "@/lib/documents/trombi";
import { formatDateShort } from "@/lib/format-date";
import { requireProjetAccess } from "@/lib/auth/session";

function cachetOrder(cachet: string | null) {
  const idx = cachet ? TROMBI_CACHET_ORDER.indexOf(cachet) : -1;
  return idx === -1 ? TROMBI_CACHET_ORDER.length : idx;
}

type Row = {
  id: string;
  date: string;
  cachet: string | null;
  fonction: string | null;
  figurant_id: string;
  figurants: { prenom: string; nom: string } | null;
};

export default async function ResumeProjetPage({
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
  const [{ data: projet }, journees, { data: bookingsRaw }] = await Promise.all([
    supabase.from("projets").select("nom").eq("id", projet_id).single(),
    getJournees(projet_id),
    supabase
      .from("bookings")
      .select("id, date, cachet, fonction, figurant_id, figurants!bookings_figurant_id_fkey(prenom, nom)")
      .eq("projet_id", projet_id)
      .eq("statut", "confirmé")
      .returns<Row[]>(),
  ]);

  const bookings = bookingsRaw ?? [];
  const photosByFigurant = await getPhotosByFigurantId(bookings.map((b) => b.figurant_id));

  // Une colonne par journée existante, même sans booking dessus — pour voir
  // les trous d'un coup d'œil autant que le remplissage.
  const dates = journees.map((j) => ({ date: j.date, numero: j.numero }));

  const rowMeta = new Map<string, { cachet: string | null; fonction: string | null }>();
  const cellRows = new Map<string, Row[]>();
  for (const b of bookings) {
    const rowKey = `${b.cachet ?? ""}||${b.fonction ?? ""}`;
    if (!rowMeta.has(rowKey)) rowMeta.set(rowKey, { cachet: b.cachet, fonction: b.fonction });
    const cellKey = `${rowKey}|${b.date}`;
    const list = cellRows.get(cellKey) ?? [];
    list.push(b);
    cellRows.set(cellKey, list);
  }

  const rows = Array.from(rowMeta.entries()).sort(([, a], [, b]) => {
    const diff = cachetOrder(a.cachet) - cachetOrder(b.cachet);
    if (diff !== 0) return diff;
    return (a.fonction ?? "").localeCompare(b.fonction ?? "");
  });

  const rowTotal = (rowKey: string) =>
    dates.reduce((sum, d) => sum + (cellRows.get(`${rowKey}|${d.date}`)?.length ?? 0), 0);

  // Décompte par cachet (toutes fonctions confondues) — vue d'ensemble
  // rapide type "1 Silhouette, 12 Figurant..." en tête de page.
  const cachetCounts = new Map<string, number>();
  for (const b of bookings) {
    const key = b.cachet ?? "Sans cachet";
    cachetCounts.set(key, (cachetCounts.get(key) ?? 0) + 1);
  }
  const cachetSummary = Array.from(cachetCounts.entries()).sort(
    ([a], [b]) => cachetOrder(a === "Sans cachet" ? null : a) - cachetOrder(b === "Sans cachet" ? null : b)
  );

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/bookings" label="Retour" />

      <div>
        <h1 className="text-2xl font-semibold">Résumé — {projet?.nom}</h1>
        <p className="mt-1 text-text-muted">
          Toutes les journées d&apos;un coup d&apos;œil, rangées par cachet et fonction.
        </p>
      </div>

      {cachetSummary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {cachetSummary.map(([cachet, count]) => (
            <Badge key={cachet} tone="turquoise">
              {count} {cachet}
            </Badge>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[10rem] bg-ink-raised px-4 py-3 text-left align-bottom">
                Cachet / Fonction
              </th>
              {dates.map((d) => (
                <th key={d.date} className="min-w-[6rem] border-l border-border bg-ink-raised px-2 py-3 text-center align-bottom">
                  <Link
                    href={`/bookings/documents?projet_id=${projet_id}&date=${d.date}`}
                    className="flex flex-col items-center hover:text-coral"
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                      J{d.numero}
                    </span>
                    <span className="text-xs font-semibold">{formatDateShort(d.date)}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([rowKey, { cachet, fonction }]) => (
              <tr key={rowKey} className="border-t border-border">
                <td className="sticky left-0 z-10 bg-ink px-4 py-2 align-top">
                  <div className="font-medium">{cachet ?? "Sans cachet"}</div>
                  <div className="text-xs text-text-muted">
                    {fonction ?? "Sans fonction"} · {rowTotal(rowKey)}
                  </div>
                </td>
                {dates.map((d) => {
                  const cellBookings = cellRows.get(`${rowKey}|${d.date}`) ?? [];
                  return (
                    <td key={d.date} className="border-l border-border px-1.5 py-2 align-top">
                      <div className="flex flex-col items-center gap-1.5">
                        {cellBookings.map((b) => {
                          const portrait = pickPortrait(photosByFigurant.get(b.figurant_id), projet_id);
                          return (
                            <div key={b.id} className="flex flex-col items-center gap-0.5">
                              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-ink-raised-2">
                                {portrait?.url && (
                                  <Image src={portrait.url} alt="" fill className="object-cover" unoptimized />
                                )}
                              </div>
                              <span className="max-w-[5.5rem] text-center text-[10px] leading-tight text-text-muted">
                                {b.figurants ? `${b.figurants.prenom} ${b.figurants.nom}` : "—"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={dates.length + 1} className="px-4 py-10 text-center text-text-muted">
                  Aucun booking confirmé pour l&apos;instant.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
