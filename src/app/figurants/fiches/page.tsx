import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFutureBookingsByFigurant, getPhotosByFigurantId, pickFichePhotos } from "@/lib/documents/data";
import { computeAge, parseIds } from "@/lib/documents/fields";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { MensurationSheet } from "@/components/documents/mensuration-sheet";
import type { Figurant } from "@/lib/figurants/types";

export default async function FigurantsFichesPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const selectedIds = parseIds(ids);

  if (!selectedIds || selectedIds.size === 0) {
    return <p className="text-text-muted">Sélectionne des profils depuis Base Profils pour générer leurs fiches.</p>;
  }

  const supabase = createAdminClient();
  const { data: figurantsRaw } = await supabase
    .from("figurants")
    .select("*")
    .in("id", Array.from(selectedIds))
    .returns<Figurant[]>();

  const figurants = (figurantsRaw ?? []).sort((a, b) =>
    `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`)
  );
  const figurantIds = figurants.map((f) => f.id);
  const today = new Date().toISOString().slice(0, 10);
  const [photosByFigurant, futureBookingsByFigurant] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    getFutureBookingsByFigurant(figurantIds, today),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/figurants" className="print-hide text-sm text-text-muted hover:text-coral">
        ← Retour à Base Profils
      </Link>

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Fiches de renseignements ({figurants.length})
        </h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename="fiches-renseignements.pdf" orientation="landscape" />
          <PrintButton />
        </div>
      </div>

      {figurants.map((f) => {
        const photos = pickFichePhotos(photosByFigurant.get(f.id));
        const age = computeAge(f.date_naissance);
        const coordonnees = [f.telephone, f.email, f.ville, age !== null ? `${age} ans` : null].filter(Boolean);

        return (
          <PrintSheet key={f.id} orientation="landscape">
            <div className="break-after-page">
              <MensurationSheet
                figurant={f}
                photos={photos}
                header={
                  coordonnees.length > 0 ? (
                    <p className="mt-0.5 text-sm text-gray-600">{coordonnees.join(" · ")}</p>
                  ) : undefined
                }
                futureBookings={futureBookingsByFigurant.get(f.id) ?? []}
              />
            </div>
          </PrintSheet>
        );
      })}
    </div>
  );
}
