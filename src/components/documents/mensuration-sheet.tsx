import Image from "next/image";
import type { Figurant } from "@/lib/figurants/types";
import type { FigurantPhotoWithUrl, FutureBooking } from "@/lib/documents/data";
import { formatDateShort } from "@/lib/format-date";
import { t, DEFAULT_LANG, type Lang } from "@/lib/i18n/partage";

export type FieldRow = [string, string | null];

function mensurationRows(f: Figurant, lang: Lang): FieldRow[] {
  return [
    [t(lang, "hauteur"), f.taille_cm ? `${f.taille_cm} cm` : null],
    [t(lang, "poids"), f.poids_kg ? `${f.poids_kg} kg` : null],
    [t(lang, "veste"), f.veste],
    [t(lang, "pantalon"), f.pantalon],
    [t(lang, "tour_tete"), f.tour_tete_cm ? `${f.tour_tete_cm} cm` : null],
    [t(lang, "tour_cou"), f.tour_cou_cm ? `${f.tour_cou_cm} cm` : null],
    [t(lang, "tour_poitrine"), f.tour_poitrine_cm ? `${f.tour_poitrine_cm} cm` : null],
    [t(lang, "tour_taille"), f.tour_taille_cm ? `${f.tour_taille_cm} cm` : null],
    [t(lang, "tour_hanches"), f.tour_hanches_cm ? `${f.tour_hanches_cm} cm` : null],
    [t(lang, "jambes_ext"), f.jambes_ext_cm ? `${f.jambes_ext_cm} cm` : null],
    [t(lang, "jambes_int"), f.jambes_int_cm ? `${f.jambes_int_cm} cm` : null],
    [t(lang, "pointure"), f.pointure ? `${f.pointure}` : null],
    [t(lang, "gant"), f.gant],
    [t(lang, "carrure"), f.carrure_cm ? `${f.carrure_cm} cm` : null],
  ];
}

export function MensurationSheet({
  figurant,
  photos,
  header,
  extraRows,
  futureBookings,
  numeroCostume,
  lang = DEFAULT_LANG,
}: {
  figurant: Figurant;
  photos: FigurantPhotoWithUrl[];
  header?: React.ReactNode;
  extraRows?: FieldRow[];
  futureBookings?: FutureBooking[];
  numeroCostume?: string | null;
  lang?: Lang;
}) {
  const rows = mensurationRows(figurant, lang);
  const mainPhotos = photos.slice(0, 3);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold">
          {figurant.civilite ? `${figurant.civilite} ` : ""}
          {figurant.prenom} {figurant.nom}
          {figurant.pronom && (
            <span className="text-sm font-normal text-gray-500">({figurant.pronom})</span>
          )}
          {numeroCostume && (
            <span className="rounded-full border border-gray-400 px-2 py-0.5 text-sm font-semibold">
              {t(lang, "costume")} {numeroCostume}
            </span>
          )}
        </h2>
        {header}
        {futureBookings && futureBookings.length > 0 && (
          <p className="mt-0.5 text-sm text-gray-600">
            <span className="font-medium text-gray-700">{t(lang, "autres_dates_bookees")} </span>
            {futureBookings
              .map((b) => `${formatDateShort(b.date)}${b.projetNom ? ` (${b.projetNom})` : ""}`)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="flex gap-4">
        <table className="w-36 shrink-0 table-fixed border-collapse border border-gray-300 text-xs">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b border-gray-300 last:border-0">
                <td className="border-r border-gray-300 py-1 pl-2 pr-1 font-medium text-gray-600">{label}</td>
                <td className="py-1 pl-2 pr-1">{value ?? ""}</td>
              </tr>
            ))}
            {extraRows?.map(([label, value]) => (
              <tr key={label} className="border-t border-gray-300 first:border-t-2">
                <td className="border-r border-gray-300 py-1 pl-2 pr-1 font-medium text-gray-600">{label}</td>
                <td className="py-1 pl-2 pr-1">{value ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex flex-1 gap-3">
          {mainPhotos.map((p) => (
            <div key={p.id} className="relative h-80 flex-1 min-w-0 overflow-hidden rounded bg-gray-100">
              {p.url && (
                <Image src={p.url} alt={p.type} fill className="object-contain" />
              )}
            </div>
          ))}
          {Array.from({ length: Math.max(0, 3 - mainPhotos.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex h-80 flex-1 min-w-0 items-center justify-center rounded bg-gray-100 text-xs text-gray-400"
            >
              —
            </div>
          ))}
        </div>
      </div>

      <div className="h-24 rounded border border-gray-200" />
    </div>
  );
}
