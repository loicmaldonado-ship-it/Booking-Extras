import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartageToken } from "@/lib/partage/data";
import {
  getPhotosByFigurantId,
  pickPortrait,
  getCachetFonctionByFigurant,
  getProjetBookingDatesByFigurant,
} from "@/lib/documents/data";
import { buildSlotItems, type PartageEssayageRow } from "@/lib/essayages/partage-planning";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { formatDateShort, formatDateLong } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";

const COLUMN_COUNT = 9;

export default async function PartageEssayagesPlanningPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { token } = await params;
  const { date } = await searchParams;
  const projet = await resolvePartageToken(token, "essayages");

  if (!projet) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Lien introuvable</h1>
        <p className="text-text-muted">Ce lien de partage n&apos;est plus valide.</p>
      </div>
    );
  }

  if (!date) {
    return <p className="text-text-muted">Choisis une journée depuis le planning.</p>;
  }

  const supabase = createAdminClient();
  const { data: essayagesRaw } = await supabase
    .from("essayages")
    .select("id, numero, date, heure, lieu, statut, notes, numero_costume, creneau_id, figurants(id, prenom, nom)")
    .eq("projet_id", projet.id)
    .eq("date", date)
    .in("statut", ["confirmé", "fait"])
    .returns<PartageEssayageRow[]>();

  const essayages = essayagesRaw ?? [];

  const creneauIds = essayages.map((e) => e.creneau_id).filter((id): id is string => !!id);
  const figurantIds = essayages.map((e) => e.figurants?.id).filter((id): id is string => !!id);
  const [{ data: creneauxRaw }, photosByFigurant, cachetFonctionByFigurant, bookingDatesByFigurant] = await Promise.all([
    creneauIds.length > 0
      ? supabase.from("essayage_creneaux").select("id, heure_debut, heure_fin").in("id", creneauIds)
      : Promise.resolve({ data: [] as { id: string; heure_debut: string; heure_fin: string }[] }),
    getPhotosByFigurantId(figurantIds),
    getCachetFonctionByFigurant(projet.id, figurantIds),
    getProjetBookingDatesByFigurant(projet.id, figurantIds),
  ]);
  const creneauById = new Map((creneauxRaw ?? []).map((c) => [c.id, c]));

  const items = buildSlotItems(essayages, creneauById);

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/partage/essayages/${token}`} className="print-hide text-sm text-text-muted hover:text-coral">
        ← Retour au planning
      </Link>

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Planning essayage — {projetNomPublic(projet)} — {formatDateShort(date)}
        </h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`planning-essayage-${projet.nom}-${date}.pdf`} orientation="landscape" />
          <PrintButton />
        </div>
      </div>

      <PrintSheet orientation="landscape">
        <DocumentLetterhead
          societe={projet.societe_production}
          filmNom={projet.nom}
          dateLabel={formatDateLong(date)}
          realisateur={projet.realisateur}
        />

        {items.length === 0 ? (
          <p className="py-6 text-center text-gray-500">Aucun essayage confirmé pour cette journée.</p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-black text-left">
                <th className="py-2 pr-3">Photo</th>
                <th className="py-2 pr-3">Figurant</th>
                <th className="py-2 pr-3">Fonction</th>
                <th className="py-2 pr-3">Cachet</th>
                <th className="py-2 pr-3">Costume</th>
                <th className="py-2 pr-3">Dates de tournage</th>
                <th className="py-2 pr-3">Lieu</th>
                <th className="py-2 pr-3">Statut</th>
                <th className="py-2 pr-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ row: e, slotLabel: label, showSlotHeader, slotNumber }) => {
                const portrait = e.figurants ? pickPortrait(photosByFigurant.get(e.figurants.id), projet.id) : null;
                const cf = e.figurants ? cachetFonctionByFigurant.get(e.figurants.id) : null;
                const tournageDates = e.figurants ? bookingDatesByFigurant.get(e.figurants.id) ?? [] : [];
                return (
                  <Fragment key={e.id}>
                    {showSlotHeader && (
                      <tr>
                        <td colSpan={COLUMN_COUNT} className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-gray-700 first:pt-1">
                          Créneau {slotNumber} : {label}
                        </td>
                      </tr>
                    )}
                    <tr className="border-b border-gray-300">
                      <td className="py-1.5 pr-3">
                        <div className="relative h-14 w-10 overflow-hidden rounded bg-gray-100">
                          {portrait?.url && <Image src={portrait.url} alt="" fill className="object-cover" unoptimized />}
                        </div>
                      </td>
                      <td className="py-1.5 pr-3 font-medium">
                        #{e.numero} {e.figurants ? `${e.figurants.prenom} ${e.figurants.nom}` : "—"}
                      </td>
                      <td className="py-1.5 pr-3">{cf?.fonction ?? "—"}</td>
                      <td className="py-1.5 pr-3">{cf?.cachet ?? "—"}</td>
                      <td className="py-1.5 pr-3">{e.numero_costume ?? "—"}</td>
                      <td className="py-1.5 pr-3">
                        {tournageDates.length > 0 ? tournageDates.map((b) => formatDateShort(b.date)).join(", ") : "—"}
                      </td>
                      <td className="py-1.5 pr-3">{e.lieu ?? "—"}</td>
                      <td className="py-1.5 pr-3">{e.statut}</td>
                      <td className="py-1.5 pr-3">{e.notes ?? "—"}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </PrintSheet>
    </div>
  );
}
