import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { BackLink } from "@/components/ui/back-link";
import { Badge } from "@/components/ui/card";
import { getJournees } from "@/lib/bookings/journees";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { toGalleryPhotos, galleryIndexOfUrl } from "@/lib/figurants/photo-labels";
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

  // Une ligne par cachet (pas par cachet+fonction) — la fonction, elle,
  // s'affiche directement sur la carte de chaque personne dans les cases,
  // pour garder le tableau compact même avec beaucoup de fonctions distinctes.
  const rowMeta = new Map<string, string | null>();
  const cellRows = new Map<string, Row[]>();
  for (const b of bookings) {
    const rowKey = b.cachet ?? "";
    if (!rowMeta.has(rowKey)) rowMeta.set(rowKey, b.cachet);
    const cellKey = `${rowKey}|${b.date}`;
    const list = cellRows.get(cellKey) ?? [];
    list.push(b);
    cellRows.set(cellKey, list);
  }

  const rows = Array.from(rowMeta.entries()).sort(([, a], [, b]) => cachetOrder(a) - cachetOrder(b));

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

  // Largeur de colonne calculée à partir du remplissage réel : jusqu'à 10
  // profils par ligne avant de passer à la ligne suivante — un flex-wrap
  // seul ne pousse pas une colonne de table à s'élargir, il faut lui donner
  // la largeur explicitement via <colgroup>.
  const UNIT_PX = 40;
  const MAX_PER_ROW = 10;
  // Plancher pour que la date + "X au total" de l'en-tête ne débordent
  // jamais, même quand la journée n'a personne de booké.
  const MIN_COL_PX = 96;
  function columnWidthPx(date: string) {
    let max = 0;
    for (const [rowKey] of rows) {
      const count = cellRows.get(`${rowKey}|${date}`)?.length ?? 0;
      if (count > max) max = count;
    }
    const unitsPerRow = Math.max(1, Math.min(max, MAX_PER_ROW));
    return Math.max(unitsPerRow * UNIT_PX + 12, MIN_COL_PX);
  }
  const FIRST_COL_PX = 160;
  const totalTableWidthPx = FIRST_COL_PX + dates.reduce((sum, d) => sum + columnWidthPx(d.date), 0);

  const dateTotal = (date: string) =>
    rows.reduce((sum, [rowKey]) => sum + (cellRows.get(`${rowKey}|${date}`)?.length ?? 0), 0);


  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/bookings" label="Retour" />

      <div>
        <h1 className="text-2xl font-semibold">Résumé — {projet?.nom}</h1>
        <p className="mt-1 text-text-muted">
          Toutes les journées d&apos;un coup d&apos;œil, rangées par cachet — fonction affichée sur chaque profil.
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
        <table className="border-collapse text-sm" style={{ tableLayout: "fixed", width: totalTableWidthPx }}>
          <colgroup>
            <col style={{ width: FIRST_COL_PX }} />
            {dates.map((d) => (
              <col key={d.date} style={{ width: `${columnWidthPx(d.date)}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-ink-raised px-4 py-3 text-left align-bottom">
                Cachet / Fonction
              </th>
              {dates.map((d) => (
                <th key={d.date} className="border-l border-border bg-ink-raised px-2 py-3 text-center align-bottom">
                  <Link
                    href={`/bookings/documents?projet_id=${projet_id}&date=${d.date}`}
                    className="flex flex-col items-center hover:text-coral"
                  >
                    <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
                      J{d.numero}
                    </span>
                    <span className="text-xs font-semibold">{formatDateShort(d.date)}</span>
                    <span className="text-[10px] text-text-muted">{dateTotal(d.date)} au total</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([rowKey, cachet]) => (
              <tr key={rowKey} className="border-t border-border">
                <td className="sticky left-0 z-10 bg-ink px-4 py-2 align-top">
                  <div className="font-medium">{cachet ?? "Sans cachet"}</div>
                  <div className="text-xs text-text-muted">{rowTotal(rowKey)}</div>
                </td>
                {dates.map((d) => {
                  const cellBookings = cellRows.get(`${rowKey}|${d.date}`) ?? [];
                  return (
                    <td key={d.date} className="border-l border-border px-1.5 py-2 align-top">
                      {cellBookings.length > 0 && (
                        <div className="mb-1 text-center text-[10px] font-semibold text-coral">
                          {cellBookings.length}
                        </div>
                      )}
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {cellBookings.map((b) => {
                          const portrait = pickPortrait(photosByFigurant.get(b.figurant_id), projet_id);
                          return (
                            <div
                              key={b.id}
                              title={b.figurants ? `${b.figurants.prenom} ${b.figurants.nom}` : ""}
                              className="flex w-9 shrink-0 flex-col items-center gap-0.5"
                            >
                              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-ink-raised-2">
                                {portrait?.url && (() => {
                                  const gallery = toGalleryPhotos(photosByFigurant.get(b.figurant_id));
                                  return (
                                    <ZoomableImage
                                      src={portrait.url!}
                                      imgClassName="rounded-full object-cover"
                                      gallery={gallery}
                                      index={galleryIndexOfUrl(gallery, portrait.url)}
                                    />
                                  );
                                })()}
                              </div>
                              <span className="w-full truncate text-center text-[8px] leading-tight text-text-muted">
                                {b.figurants?.prenom ?? "—"}
                              </span>
                              <span className="w-full truncate text-center text-[7px] leading-tight text-text-muted/60">
                                {b.fonction ?? "—"}
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
