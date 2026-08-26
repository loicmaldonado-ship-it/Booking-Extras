import Link from "next/link";
import {
  getConfirmedBookings,
  getFutureBookingsByFigurant,
  getPhotosByFigurantId,
  pickFichePhotos,
} from "@/lib/documents/data";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { FieldsToggle } from "@/components/documents/fields-toggle";
import { MensurationSheet } from "@/components/documents/mensuration-sheet";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { getDocumentTemplate } from "@/lib/documents/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAge, parseFields, formatHeureConvocation, type DocumentField } from "@/lib/documents/fields";
import { formatDateShort, formatDateLong } from "@/lib/format-date";
import { resolveDocumentsShareToken } from "@/lib/partage/data";
import { projetNomPublic } from "@/lib/projets/types";
import { LangToggle } from "@/components/partage/lang-toggle";
import { t, tCachet, parseLang, localeFor } from "@/lib/i18n/partage";

const DEFAULT_FIELDS: DocumentField[] = ["fonction", "telephone", "email", "ville"];

export default async function PartageFichesPage({
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

  const selectedFields = fields === undefined ? new Set(DEFAULT_FIELDS) : parseFields(fields);
  if (!showContacts) {
    selectedFields.delete("telephone");
    selectedFields.delete("email");
  }

  const bookings = await getConfirmedBookings(projet.id, date);
  const figurantIds = bookings.map((b) => b.figurant.id);
  const today = new Date().toISOString().slice(0, 10);
  const [photosByFigurant, futureBookingsByFigurant] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    getFutureBookingsByFigurant(figurantIds, today),
  ]);
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
        <h1 className="text-2xl font-semibold">{t(lang, "fiches_mensuration")}</h1>
        <div className="flex items-center gap-3">
          <LangToggle lang={lang} basePath={`/partage/documents/${token}/fiches`} otherParams={{ date }} />
          <DownloadPdfButton filename={`fiches-mensuration-${date}.pdf`} orientation="landscape" lang={lang} />
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

      {bookings.length === 0 && (
        <PrintSheet orientation="landscape">
          <p className="py-6 text-center text-gray-500">{t(lang, "aucun_booking_confirme")}</p>
        </PrintSheet>
      )}

      {bookings.map((b) => {
        const f = b.figurant;
        const photos = pickFichePhotos(photosByFigurant.get(f.id), projet.id);
        const age = computeAge(f.date_naissance);
        const coordonnees = [
          selectedFields.has("telephone") ? f.telephone : null,
          selectedFields.has("email") ? f.email : null,
          selectedFields.has("ville") ? f.ville : null,
          selectedFields.has("age") && age !== null ? `${age} ${t(lang, "ans")}` : null,
        ].filter(Boolean);

        return (
          <PrintSheet key={b.id} orientation="landscape">
            <div className="break-after-page">
              <DocumentLetterhead
                societe={projet.societe_production}
                filmNom={projetNomPublic(projet)}
                dateLabel={formatDateLong(date, localeFor(lang))}
                realisateur={projet.realisateur}
                logoUrl={documentTemplate.logoUrl}
                accentColor={documentTemplate.accentColor}
                lang={lang}
              />
              <MensurationSheet
                figurant={f}
                photos={photos}
                lang={lang}
                header={
                  <>
                    <p className="mt-0.5 text-sm text-gray-600">
                      {formatDateShort(date)}
                      {selectedFields.has("fonction") && b.fonction ? ` · ${b.fonction}` : ""}
                    </p>
                    {coordonnees.length > 0 && (
                      <p className="text-sm text-gray-600">{coordonnees.join(" · ")}</p>
                    )}
                  </>
                }
                extraRows={[
                  [t(lang, "cachet"), tCachet(lang, b.cachet) ?? "—"],
                  [t(lang, "convocation"), b.heure_convocation ? formatHeureConvocation(b.heure_convocation) : "—"],
                ]}
                futureBookings={(futureBookingsByFigurant.get(f.id) ?? []).filter((fb) => fb.id !== b.id)}
              />
            </div>
          </PrintSheet>
        );
      })}
    </div>
  );
}
