import { Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { getConfirmedBookings, getPhotosByFigurantId, pickPortrait, type ConfirmedBooking } from "@/lib/documents/data";
import { getDocumentTemplate } from "@/lib/documents/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { FieldsToggle } from "@/components/documents/fields-toggle";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { computeAge, parseFields, formatHeureConvocation } from "@/lib/documents/fields";
import { formatDateLong } from "@/lib/format-date";
import { resolveDocumentsShareToken } from "@/lib/partage/data";
import { projetNomPublic } from "@/lib/projets/types";
import { LangToggle } from "@/components/partage/lang-toggle";
import { t, tCachet, parseLang, localeFor, type Lang } from "@/lib/i18n/partage";
import { paginateGroupedItems } from "@/lib/documents/trombi";

// Ordre d'affichage voulu sur les trombis : silhouettes, puis doublures, puis figurants en dernier.
const TROMBI_CACHET_ORDER = [
  "Silhouette",
  "Silhouette parlante",
  "Doublure simple",
  "Doublure polyvalente",
  "Rôle",
  "Figurant",
];

type FlatItem = {
  booking: ConfirmedBooking;
  heureLabel: string;
  cachetLabel: string;
  fonctionLabel: string;
};

function cachetOrder(cachet: string | null) {
  const idx = cachet ? TROMBI_CACHET_ORDER.indexOf(cachet) : -1;
  return idx === -1 ? TROMBI_CACHET_ORDER.length : idx;
}

function flattenByHeureEtCachet(bookings: ConfirmedBooking[], sortByFonction: boolean, lang: Lang): FlatItem[] {
  const byHeure = new Map<string, ConfirmedBooking[]>();
  for (const b of bookings) {
    const key = b.heure_convocation ?? "";
    const list = byHeure.get(key) ?? [];
    list.push(b);
    byHeure.set(key, list);
  }

  const items: FlatItem[] = [];
  for (const [heure, group] of Array.from(byHeure.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const heureLabel = heure ? formatHeureConvocation(heure) : t(lang, "heure_non_renseignee");
    const byCachet = new Map<string, ConfirmedBooking[]>();
    for (const b of group) {
      const key = b.cachet ?? "Cachet non assigné";
      const list = byCachet.get(key) ?? [];
      list.push(b);
      byCachet.set(key, list);
    }
    const cachetGroups = Array.from(byCachet.entries()).sort(
      (a, b) => cachetOrder(a[1][0]?.cachet ?? null) - cachetOrder(b[1][0]?.cachet ?? null)
    );
    for (const [cachetLabel, sousGroup] of cachetGroups) {
      const nomSort = (a: ConfirmedBooking, b: ConfirmedBooking) =>
        `${a.figurant.prenom} ${a.figurant.nom}`.localeCompare(`${b.figurant.prenom} ${b.figurant.nom}`);
      const sorted = sortByFonction
        ? [...sousGroup].sort((a, b) => (a.fonction ?? "").localeCompare(b.fonction ?? "") || nomSort(a, b))
        : [...sousGroup].sort(nomSort);
      for (const b of sorted) {
        items.push({
          booking: b,
          heureLabel,
          cachetLabel: cachetLabel === "Cachet non assigné" ? t(lang, "cachet_non_assigne") : tCachet(lang, cachetLabel) ?? cachetLabel,
          fonctionLabel: b.fonction ?? t(lang, "sans_fonction_assignee"),
        });
      }
    }
  }
  return items;
}

export default async function PartageTrombisPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ date?: string; fields?: string | string[]; lang?: string }>;
}) {
  const { token } = await params;
  const { date: queryDate, fields, lang: langRaw } = await searchParams;
  const lang = parseLang(langRaw);
  const share = await resolveDocumentsShareToken(token);
  const date = share?.dateLock ?? queryDate;

  if (!share || !date) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t(lang, "lien_introuvable")}</h1>
        <p className="text-text-muted">{t(lang, "lien_invalide")}</p>
      </div>
    );
  }

  const { projet, showContacts } = share;

  // Les trombis n'affichent téléphone/email que si le lien a été généré
  // "avec les contacts" (showContacts) — décision explicite prise au moment
  // du partage, la même que pour la fiche mensu.
  const selectedFields = parseFields(fields);
  if (!showContacts) {
    selectedFields.delete("telephone");
    selectedFields.delete("email");
  }
  const showFonction = selectedFields.has("fonction");

  const bookings = await getConfirmedBookings(projet.id, date);
  const photosByFigurant = await getPhotosByFigurantId(bookings.map((b) => b.figurant.id));
  const pages = paginateGroupedItems(
    flattenByHeureEtCachet(bookings, showFonction, lang),
    (i) => `${i.heureLabel}·${i.cachetLabel}${showFonction ? `·${i.fonctionLabel}` : ""}`
  );
  const documentTemplate = await getDocumentTemplate(createAdminClient(), projet.id);

  return (
    <div className="flex flex-col gap-4">
      {!share.dateLock && (
        <Link
          href={`/partage/documents/${token}?lang=${lang}`}
          className="print-hide text-sm text-text-muted hover:text-coral"
        >
          {t(lang, "retour_journees")}
        </Link>
      )}

      <div className="print-hide flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t(lang, "trombis")}</h1>
        <div className="flex items-center gap-3">
          <LangToggle lang={lang} basePath={`/partage/documents/${token}/trombis`} otherParams={{ date }} />
          <DownloadPdfButton filename={`trombis-${date}.pdf`} orientation="landscape" lang={lang} />
          <PrintButton lang={lang} />
        </div>
      </div>

      <FieldsToggle
        projetId={projet.id}
        date={date}
        selected={selectedFields}
        excludeFields={showContacts ? ["sexe"] : ["telephone", "email", "sexe"]}
        lang={lang}
      />

      {pages.length === 0 && (
        <PrintSheet orientation="landscape">
          <DocumentLetterhead
            societe={projet.societe_production}
            filmNom={projetNomPublic(projet)}
            dateLabel={formatDateLong(date, localeFor(lang))}
            realisateur={projet.realisateur}
            logoUrl={documentTemplate.logoUrl}
            accentColor={documentTemplate.accentColor}
            lang={lang}
          />
          <p className="py-6 text-center text-gray-500">{t(lang, "aucun_booking_confirme")}</p>
        </PrintSheet>
      )}

      {pages.map((page, pageIndex) => {
        let lastHeure: string | null = null;
        let lastCachet: string | null = null;
        let lastFonction: string | null = null;

        return (
          <PrintSheet
            key={pageIndex}
            orientation="landscape"
            fixedHeight
            className="break-after-page print:break-after-page"
            pageLabel={pages.length > 1 ? `${pageIndex + 1} / ${pages.length}` : undefined}
          >
            <DocumentLetterhead
              societe={projet.societe_production}
              filmNom={projetNomPublic(projet)}
              dateLabel={formatDateLong(date, localeFor(lang))}
              realisateur={projet.realisateur}
            logoUrl={documentTemplate.logoUrl}
            accentColor={documentTemplate.accentColor}
            lang={lang}
            />

            <div className="flex flex-wrap gap-x-3 gap-y-2">
              {page.map((item) => {
                const showHeader =
                  item.heureLabel !== lastHeure ||
                  item.cachetLabel !== lastCachet ||
                  (showFonction && item.fonctionLabel !== lastFonction);
                lastHeure = item.heureLabel;
                lastCachet = item.cachetLabel;
                lastFonction = item.fonctionLabel;
                const portrait = pickPortrait(photosByFigurant.get(item.booking.figurant.id), projet.id);
                const age = computeAge(item.booking.figurant.date_naissance);

                return (
                  <Fragment key={item.booking.id}>
                    {showHeader && (
                      <div className="mt-1 w-full border-b border-gray-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 first:mt-0">
                        {item.heureLabel} · {item.cachetLabel}
                        {showFonction ? ` · ${item.fonctionLabel}` : ""}
                      </div>
                    )}
                    <div className="flex w-24 flex-col items-center gap-0.5 text-center">
                      <div className="relative h-32 w-24 overflow-hidden rounded bg-gray-100">
                        {portrait?.url && (
                          <Image src={portrait.url} alt="" fill className="object-cover" unoptimized />
                        )}
                      </div>
                      <span className="text-[10px] font-medium leading-tight">
                        {item.booking.figurant.prenom} {item.booking.figurant.nom}
                      </span>
                      {showFonction && item.booking.fonction && (
                        <span className="text-[8px] italic leading-tight text-gray-500">
                          {item.booking.fonction}
                        </span>
                      )}
                      <div className="flex flex-col text-[8px] leading-tight text-gray-600">
                        {selectedFields.has("age") && age !== null && (
                          <span>
                            {age} {t(lang, "ans")}
                          </span>
                        )}
                        {selectedFields.has("ville") && item.booking.figurant.ville && (
                          <span>{item.booking.figurant.ville}</span>
                        )}
                        {selectedFields.has("telephone") && item.booking.figurant.telephone && (
                          <span>{item.booking.figurant.telephone}</span>
                        )}
                        {selectedFields.has("email") && item.booking.figurant.email && (
                          <span className="max-w-24 truncate">{item.booking.figurant.email}</span>
                        )}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </PrintSheet>
        );
      })}
    </div>
  );
}
