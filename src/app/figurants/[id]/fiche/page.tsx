import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFutureBookingsByFigurant, getPhotosByFigurantId, pickFichePhotos } from "@/lib/documents/data";
import { computeAge } from "@/lib/documents/fields";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { MensurationSheet } from "@/components/documents/mensuration-sheet";
import { BackLink } from "@/components/ui/back-link";
import type { Figurant } from "@/lib/figurants/types";

export default async function FigurantFichePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: figurant } = await supabase
    .from("figurants")
    .select("*")
    .eq("id", id)
    .single<Figurant>();

  if (!figurant) notFound();

  const today = new Date().toISOString().slice(0, 10);
  const [photosByFigurant, futureBookingsByFigurant] = await Promise.all([
    getPhotosByFigurantId([id]),
    getFutureBookingsByFigurant([id], today),
  ]);
  const photos = pickFichePhotos(photosByFigurant.get(id));
  const age = computeAge(figurant.date_naissance);

  const coordonnees = [
    figurant.telephone,
    figurant.email,
    figurant.ville,
    age !== null ? `${age} ans` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <BackLink href={`/figurants/${id}`} label="Retour au profil" />

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fiche mensuration</h1>
        <div className="flex gap-3">
          <DownloadPdfButton
            filename={`fiche-mensuration-${figurant.prenom}-${figurant.nom}.pdf`}
            orientation="landscape"
          />
          <PrintButton />
        </div>
      </div>

      <PrintSheet orientation="landscape">
        <MensurationSheet
          figurant={figurant}
          photos={photos}
          header={
            coordonnees.length > 0 ? (
              <p className="mt-0.5 text-sm text-gray-600">{coordonnees.join(" · ")}</p>
            ) : undefined
          }
          futureBookings={futureBookingsByFigurant.get(id) ?? []}
        />
      </PrintSheet>
    </div>
  );
}
