import { createAdminClient } from "@/lib/supabase/admin";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { BackToJournee } from "@/components/documents/back-to-journee";
import { formatDateShort } from "@/lib/format-date";
import { requireProjetAccess } from "@/lib/auth/session";
import { montantCovoiturage } from "@/lib/bookings/covoiturage-messages";

type Row = {
  figurant_id: string;
  covoiturage_role: "conducteur" | "passager" | null;
  covoiturage_lieu_depart: string | null;
  covoiturage_places_disponibles: number | null;
  covoiturage_conducteur_id: string | null;
  figurants: { prenom: string; nom: string; telephone: string | null } | null;
};

export default async function CovoiturageDocPage({
  searchParams,
}: {
  searchParams: Promise<{ projet_id?: string; date?: string }>;
}) {
  const { projet_id, date } = await searchParams;
  await requireProjetAccess(projet_id);

  if (!projet_id || !date) {
    return <p className="text-text-muted">Choisis un projet et une date.</p>;
  }

  const supabase = createAdminClient();
  const [{ data: projet }, { data: rowsRaw }] = await Promise.all([
    supabase
      .from("projets")
      .select("nom, covoiturage_tarif_base, covoiturage_tarif_passager")
      .eq("id", projet_id)
      .single(),
    supabase
      .from("bookings")
      .select(
        "figurant_id, covoiturage_role, covoiturage_lieu_depart, covoiturage_places_disponibles, covoiturage_conducteur_id, figurants!bookings_figurant_id_fkey(prenom, nom, telephone)"
      )
      .eq("projet_id", projet_id)
      .eq("date", date)
      .returns<Row[]>(),
  ]);

  const rows = rowsRaw ?? [];
  const tarifBase = projet?.covoiturage_tarif_base ?? 15;
  const tarifPassager = projet?.covoiturage_tarif_passager ?? 5;
  const conducteurs = rows.filter((r) => r.covoiturage_role === "conducteur");
  const sansCovoiturage = rows.filter((r) => !r.covoiturage_role);
  const nomOf = (r: Row | undefined) => (r?.figurants ? `${r.figurants.prenom} ${r.figurants.nom}` : "—");

  return (
    <div className="flex flex-col gap-4">
      <BackToJournee projetId={projet_id} date={date} />

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Résumé covoiturage</h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`covoiturage-${date}.pdf`} orientation="portrait" />
          <PrintButton />
        </div>
      </div>

      <PrintSheet>
        <h2 className="text-xl font-bold">Covoiturage — {projet?.nom}</h2>
        <p className="mb-4 text-sm text-gray-600">{formatDateShort(date)}</p>

        {conducteurs.length === 0 && (
          <p className="text-sm text-gray-600">Aucun chauffeur désigné pour cette journée.</p>
        )}

        <div className="flex flex-col gap-4">
          {conducteurs.map((c) => {
            const passagers = rows.filter((r) => r.covoiturage_conducteur_id === c.figurant_id);
            return (
              <div key={c.figurant_id} className="rounded border border-gray-400 p-3">
                <p className="font-semibold">
                  🚗 {nomOf(c)}
                  {c.figurants?.telephone ? ` — ${c.figurants.telephone}` : ""}
                </p>
                <p className="text-sm text-gray-700">
                  Départ : {c.covoiturage_lieu_depart ?? "à confirmer"}
                  {c.covoiturage_places_disponibles !== null
                    ? ` · ${c.covoiturage_places_disponibles} place(s)`
                    : ""}
                </p>
                <p className="mt-1 text-sm">
                  Passagers ({passagers.length}) :{" "}
                  {passagers.length === 0
                    ? "aucun"
                    : passagers
                        .map((p) => `${nomOf(p)}${p.figurants?.telephone ? ` (${p.figurants.telephone})` : ""}`)
                        .join(", ")}
                </p>
                <p className="mt-1 text-sm font-medium">
                  Indemnité chauffeur : {montantCovoiturage(passagers.length, tarifBase, tarifPassager)}€ (
                  {tarifBase}€ + {tarifPassager}€ × {passagers.length})
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <p className="font-semibold">Sans covoiturage ({sansCovoiturage.length})</p>
          <p className="text-sm text-gray-700">
            {sansCovoiturage.length === 0 ? "—" : sansCovoiturage.map((r) => nomOf(r)).join(", ")}
          </p>
        </div>
      </PrintSheet>
    </div>
  );
}
