import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartageToken } from "@/lib/partage/data";
import {
  getPhotosByFigurantId,
  pickFichePhotos,
  getCachetFonctionByFigurant,
} from "@/lib/documents/data";
import { computeAge } from "@/lib/documents/fields";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { MensurationSheet } from "@/components/documents/mensuration-sheet";
import { projetNomPublic } from "@/lib/projets/types";
import type { Figurant } from "@/lib/figurants/types";

type EssayageRow = { figurant_id: string; numero_costume: string | null };

export default async function PartageEssayagesFichesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const projet = await resolvePartageToken(token, "essayages");

  if (!projet) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Lien introuvable</h1>
        <p className="text-text-muted">Ce lien de partage n&apos;est plus valide.</p>
      </div>
    );
  }

  const supabase = createAdminClient();
  const { data: essayagesRaw } = await supabase
    .from("essayages")
    .select("figurant_id, numero_costume")
    .eq("projet_id", projet.id)
    .returns<EssayageRow[]>();

  const numeroCostumeByFigurant = new Map<string, string | null>();
  for (const e of essayagesRaw ?? []) {
    if (!numeroCostumeByFigurant.has(e.figurant_id) || e.numero_costume) {
      numeroCostumeByFigurant.set(e.figurant_id, e.numero_costume);
    }
  }
  const figurantIds = Array.from(numeroCostumeByFigurant.keys());

  const { data: figurantsRaw } = await supabase
    .from("figurants")
    .select("*")
    .in("id", figurantIds)
    .returns<Figurant[]>();

  const figurants = (figurantsRaw ?? []).sort((a, b) =>
    `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`)
  );

  const [photosByFigurant, cachetFonctionByFigurant] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    getCachetFonctionByFigurant(projet.id, figurantIds),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/partage/essayages/${token}`} className="print-hide text-sm text-text-muted hover:text-coral">
        ← Retour au planning
      </Link>

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Fiches de mensuration — {projetNomPublic(projet)}</h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`fiches-mensuration-${projet.nom}.pdf`} orientation="landscape" />
          <PrintButton />
        </div>
      </div>

      {figurants.length === 0 && (
        <PrintSheet orientation="landscape">
          <p className="py-6 text-center text-gray-500">Aucun essayage pour l&apos;instant.</p>
        </PrintSheet>
      )}

      {figurants.map((f) => {
        const photos = pickFichePhotos(photosByFigurant.get(f.id), projet.id);
        const age = computeAge(f.date_naissance);
        const { cachet, fonction } = cachetFonctionByFigurant.get(f.id) ?? { cachet: null, fonction: null };
        const coordonnees = [
          f.telephone,
          f.email,
          f.ville,
          age !== null ? `${age} ans` : null,
          fonction,
        ].filter(Boolean);

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
                extraRows={[["Cachet", cachet ?? "—"]]}
                numeroCostume={numeroCostumeByFigurant.get(f.id) ?? null}
              />
            </div>
          </PrintSheet>
        );
      })}
    </div>
  );
}
