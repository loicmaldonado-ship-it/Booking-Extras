import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolvePartageToken } from "@/lib/partage/data";
import {
  getPhotosByFigurantId,
  pickFichePhotos,
  getCachetFonctionByFigurant,
  getProjetBookingDatesByFigurant,
} from "@/lib/documents/data";
import { computeAge } from "@/lib/documents/fields";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { MensurationSheet } from "@/components/documents/mensuration-sheet";
import { formatDateShort } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";
import type { Figurant } from "@/lib/figurants/types";
import { LangToggle } from "@/components/partage/lang-toggle";
import { t, tCachet, parseLang } from "@/lib/i18n/partage";

type EssayageRow = {
  figurant_id: string;
  numero_costume: string | null;
  heure: string | null;
  creneau_id: string | null;
};

export default async function PartageEssayagesFichesPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ date?: string; lang?: string }>;
}) {
  const { token } = await params;
  const { date, lang: langRaw } = await searchParams;
  const lang = parseLang(langRaw);
  const projet = await resolvePartageToken(token, "essayages");

  if (!projet) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t(lang, "lien_introuvable")}</h1>
        <p className="text-text-muted">{t(lang, "lien_invalide")}</p>
      </div>
    );
  }

  const supabase = createAdminClient();
  let essayagesQuery = supabase
    .from("essayages")
    .select("figurant_id, numero_costume, heure, creneau_id")
    .eq("projet_id", projet.id)
    // Même règle que le planning : pas de fiche pour une personne dont
    // l'essayage n'est encore qu'une proposition.
    .in("statut", ["confirmé", "fait"]);
  if (date) essayagesQuery = essayagesQuery.eq("date", date);
  const { data: essayagesRaw } = await essayagesQuery.returns<EssayageRow[]>();

  const numeroCostumeByFigurant = new Map<string, string | null>();
  const heureByFigurant = new Map<string, { heure: string | null; creneau_id: string | null }>();
  for (const e of essayagesRaw ?? []) {
    if (!numeroCostumeByFigurant.has(e.figurant_id) || e.numero_costume) {
      numeroCostumeByFigurant.set(e.figurant_id, e.numero_costume);
    }
    if (!heureByFigurant.has(e.figurant_id)) {
      heureByFigurant.set(e.figurant_id, { heure: e.heure, creneau_id: e.creneau_id });
    }
  }
  const figurantIds = Array.from(numeroCostumeByFigurant.keys());

  const creneauIds = Array.from(heureByFigurant.values())
    .map((h) => h.creneau_id)
    .filter((id): id is string => !!id);
  const { data: creneauxRaw } =
    creneauIds.length > 0
      ? await supabase.from("essayage_creneaux").select("id, heure_debut").in("id", creneauIds)
      : { data: [] as { id: string; heure_debut: string }[] };
  const heureDebutByCreneau = new Map((creneauxRaw ?? []).map((c) => [c.id, c.heure_debut]));

  function effectiveHeure(figurantId: string): string {
    const h = heureByFigurant.get(figurantId);
    if (!h) return "";
    if (h.creneau_id && heureDebutByCreneau.has(h.creneau_id)) return heureDebutByCreneau.get(h.creneau_id)!;
    return h.heure ?? "";
  }

  const { data: figurantsRaw } = await supabase
    .from("figurants")
    .select("*")
    .in("id", figurantIds)
    .returns<Figurant[]>();

  // Triées par heure d'arrivée quand on filtre sur une journée précise —
  // sinon (vue tous jours confondus) l'ordre alphabétique reste plus lisible.
  const figurants = (figurantsRaw ?? []).sort((a, b) =>
    date
      ? effectiveHeure(a.id).localeCompare(effectiveHeure(b.id)) || `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`)
      : `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`)
  );

  const [photosByFigurant, cachetFonctionByFigurant, bookingDatesByFigurant] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    getCachetFonctionByFigurant(projet.id, figurantIds),
    getProjetBookingDatesByFigurant(projet.id, figurantIds),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/partage/essayages/${token}?lang=${lang}`}
        className="print-hide text-sm text-text-muted hover:text-coral"
      >
        {t(lang, "retour_planning")}
      </Link>

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {t(lang, "fiches_mensuration_titre")} — {projetNomPublic(projet)}
          {date ? ` — ${formatDateShort(date)}` : ""}
        </h1>
        <div className="flex items-center gap-3">
          <LangToggle lang={lang} basePath={`/partage/essayages/${token}/fiches`} otherParams={{ date }} />
          <DownloadPdfButton
            filename={`fiches-mensuration-${projet.nom}${date ? `-${date}` : ""}.pdf`}
            orientation="landscape"
            lang={lang}
          />
          <PrintButton lang={lang} />
        </div>
      </div>

      {figurants.length === 0 && (
        <PrintSheet orientation="landscape">
          <p className="py-6 text-center text-gray-500">{t(lang, "aucun_essayage")}</p>
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
          age !== null ? `${age} ${t(lang, "ans")}` : null,
          fonction,
        ].filter(Boolean);

        return (
          <PrintSheet key={f.id} orientation="landscape">
            <div className="break-after-page">
              <MensurationSheet
                figurant={f}
                photos={photos}
                lang={lang}
                header={
                  coordonnees.length > 0 ? (
                    <p className="mt-0.5 text-sm text-gray-600">{coordonnees.join(" · ")}</p>
                  ) : undefined
                }
                extraRows={[[t(lang, "cachet"), tCachet(lang, cachet) ?? "—"]]}
                numeroCostume={numeroCostumeByFigurant.get(f.id) ?? null}
                futureBookings={bookingDatesByFigurant.get(f.id) ?? []}
              />
            </div>
          </PrintSheet>
        );
      })}
    </div>
  );
}
