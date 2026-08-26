import Link from "next/link";
import { Card, Badge } from "@/components/ui/card";
import { LangToggle } from "@/components/partage/lang-toggle";
import { resolveDocumentsShareToken } from "@/lib/partage/data";
import { getJournees } from "@/lib/bookings/journees";
import { formatDateShort } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";
import { t, parseLang } from "@/lib/i18n/partage";

export const dynamic = "force-dynamic";

export default async function PartageDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const lang = parseLang((await searchParams).lang);
  const share = await resolveDocumentsShareToken(token);

  if (!share) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t(lang, "lien_introuvable")}</h1>
        <p className="text-text-muted">{t(lang, "lien_invalide")}</p>
      </div>
    );
  }

  const { projet, dateLock } = share;
  const journees = dateLock ? [] : await getJournees(projet.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-lg font-semibold">
          Booking<span className="text-coral">Extras</span>
        </span>
        <LangToggle lang={lang} basePath={`/partage/documents/${token}`} />
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{projetNomPublic(projet)}</h1>
        <p className="mt-1 text-text-muted">
          {dateLock
            ? t(lang, "trombis_fiches_journee", { date: formatDateShort(dateLock) })
            : t(lang, "trombis_fiches_par_journee")}
        </p>
      </div>

      {dateLock && (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">{formatDateShort(dateLock)}</p>
          <div className="flex gap-3">
            <Link
              href={`/partage/documents/${token}/trombis?date=${dateLock}&lang=${lang}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-coral/60 hover:text-text"
            >
              {t(lang, "trombis")}
            </Link>
            <Link
              href={`/partage/documents/${token}/fiches?date=${dateLock}&lang=${lang}`}
              className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-coral/60 hover:text-text"
            >
              {t(lang, "fiches_mensuration")}
            </Link>
          </div>
        </Card>
      )}

      {!dateLock && (
        <div className="flex flex-col gap-3">
          {journees.map((j) => (
            <Card key={j.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{formatDateShort(j.date)}</p>
                <div className="mt-1 flex gap-2">
                  <Badge tone="turquoise">
                    {j.confirmes} {t(lang, j.confirmes > 1 ? "confirmes" : "confirme")}
                  </Badge>
                  <Badge>{j.total} {t(lang, "au_total")}</Badge>
                </div>
              </div>
              <div className="flex gap-3">
                <Link
                  href={`/partage/documents/${token}/trombis?date=${j.date}&lang=${lang}`}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-coral/60 hover:text-text"
                >
                  {t(lang, "trombis")}
                </Link>
                <Link
                  href={`/partage/documents/${token}/fiches?date=${j.date}&lang=${lang}`}
                  className="rounded-full border border-border px-4 py-2 text-sm font-medium hover:border-coral/60 hover:text-text"
                >
                  {t(lang, "fiches_mensuration")}
                </Link>
              </div>
            </Card>
          ))}
          {journees.length === 0 && <p className="text-sm text-text-muted">{t(lang, "aucune_journee")}</p>}
        </div>
      )}
    </div>
  );
}
