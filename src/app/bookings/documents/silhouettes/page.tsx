import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { computeAge } from "@/lib/documents/fields";
import { requireProjetAccess } from "@/lib/auth/session";
import type { Figurant } from "@/lib/figurants/types";

// Silhouette et Silhouette parlante partagent le même tableau — les deux
// concernent le même poste (costume/production), sur tout le projet et
// pas une seule journée, contrairement aux trombis/fiches quotidiens.
const SILHOUETTE_CACHETS = ["Silhouette", "Silhouette parlante"];

type Row = { cachet: string | null; figurants: Figurant | null };

export default async function SilhouettesPage({
  searchParams,
}: {
  searchParams: Promise<{ projet_id?: string; date?: string }>;
}) {
  const { projet_id, date } = await searchParams;
  if (!projet_id) {
    return <p className="text-text-muted">Choisis un projet.</p>;
  }
  await requireProjetAccess(projet_id);

  const supabase = createAdminClient();
  const [{ data: projet }, { data: bookingsRaw }] = await Promise.all([
    supabase.from("projets").select("nom, realisateur, societe_production").eq("id", projet_id).single(),
    supabase
      .from("bookings")
      .select("cachet, figurants!bookings_figurant_id_fkey(*)")
      .eq("projet_id", projet_id)
      .eq("statut", "confirmé")
      .in("cachet", SILHOUETTE_CACHETS)
      .returns<Row[]>(),
  ]);

  const byFigurant = new Map<string, { figurant: Figurant; cachet: string | null }>();
  for (const b of bookingsRaw ?? []) {
    if (!b.figurants) continue;
    const existing = byFigurant.get(b.figurants.id);
    if (!existing || (b.cachet === "Silhouette parlante" && existing.cachet !== "Silhouette parlante")) {
      byFigurant.set(b.figurants.id, { figurant: b.figurants, cachet: b.cachet });
    }
  }
  const rows = Array.from(byFigurant.values()).sort((a, b) =>
    `${a.figurant.prenom} ${a.figurant.nom}`.localeCompare(`${b.figurant.prenom} ${b.figurant.nom}`)
  );

  const photosByFigurant = await getPhotosByFigurantId(rows.map((r) => r.figurant.id));
  const backHref = date ? `/bookings/documents?projet_id=${projet_id}&date=${date}` : `/bookings?projet_id=${projet_id}`;

  return (
    <div className="flex flex-col gap-4">
      <Link href={backHref} className="print-hide text-sm text-text-muted hover:text-coral">
        ← Retour
      </Link>

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tableau silhouette</h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`tableau-silhouette-${projet?.nom ?? projet_id}.pdf`} orientation="landscape" />
          <PrintButton />
        </div>
      </div>

      <PrintSheet orientation="landscape">
        <DocumentLetterhead
          societe={projet?.societe_production ?? null}
          filmNom={projet?.nom ?? ""}
          dateLabel={`${rows.length} silhouette${rows.length > 1 ? "s" : ""}`}
          realisateur={projet?.realisateur}
        />

        {rows.length === 0 ? (
          <p className="py-6 text-center text-gray-500">Aucune silhouette bookée sur ce projet.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-2 pr-3">Photo</th>
                <th className="py-2 pr-3">Nom</th>
                <th className="py-2 pr-3">Cachet</th>
                <th className="py-2 pr-3">Ville</th>
                <th className="py-2 pr-3">Téléphone</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Âge</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ figurant: f, cachet }) => {
                const portrait = pickPortrait(photosByFigurant.get(f.id), projet_id);
                const age = computeAge(f.date_naissance);
                return (
                  <tr key={f.id} className="border-b border-gray-300">
                    <td className="py-1.5 pr-3">
                      <div className="relative h-16 w-12 overflow-hidden rounded bg-gray-100">
                        {portrait?.url && <Image src={portrait.url} alt="" fill className="object-cover" unoptimized />}
                      </div>
                    </td>
                    <td className="py-1.5 pr-3 font-medium">
                      {f.prenom} {f.nom}
                    </td>
                    <td className="py-1.5 pr-3">{cachet ?? "—"}</td>
                    <td className="py-1.5 pr-3">{f.ville ?? "—"}</td>
                    <td className="py-1.5 pr-3">{f.telephone ?? "—"}</td>
                    <td className="py-1.5 pr-3">{f.email ?? "—"}</td>
                    <td className="py-1.5 pr-3">{age ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </PrintSheet>
    </div>
  );
}
