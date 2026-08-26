import { Fragment } from "react";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { resolvePartageToken } from "@/lib/partage/data";
import {
  getPhotosByFigurantId,
  pickPortrait,
  getCachetFonctionByFigurant,
  getProjetBookingDatesByFigurant,
} from "@/lib/documents/data";
import { buildSlotItems, type PartageEssayageRow } from "@/lib/essayages/partage-planning";
import { formatDateShort } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";
import { LangToggle } from "@/components/partage/lang-toggle";
import { t, tCachet, tStatut, parseLang } from "@/lib/i18n/partage";

const COLUMN_COUNT = 9;

export const dynamic = "force-dynamic";

export default async function PartageEssayagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const lang = parseLang((await searchParams).lang);
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
  const { data: essayagesRaw } = await supabase
    .from("essayages")
    .select("id, numero, date, heure, lieu, statut, notes, numero_costume, creneau_id, figurants(id, prenom, nom)")
    .eq("projet_id", projet.id)
    // Le lien de partage ne montre que ce qui est acté — les propositions pas
    // encore confirmées restent internes.
    .in("statut", ["confirmé", "fait"])
    .order("date", { ascending: true, nullsFirst: false })
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

  const byDate = new Map<string, PartageEssayageRow[]>();
  for (const e of essayages) {
    const key = e.date ?? "Date à confirmer";
    const list = byDate.get(key) ?? [];
    list.push(e);
    byDate.set(key, list);
  }

  const groups = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, dateRows]) => [date, buildSlotItems(dateRows, creneauById)] as const);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Logo iconSize={26} textClassName="text-lg" />
        <LangToggle lang={lang} basePath={`/partage/essayages/${token}`} />
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{projetNomPublic(projet)}</h1>
        <p className="mt-1 text-text-muted">{t(lang, "planning_essayages_jour")}</p>
      </div>

      <div className="flex flex-col gap-4">
        {groups.map(([date, items]) => (
          <Card key={date} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-text-muted">
                {date === "Date à confirmer" ? t(lang, "date_a_confirmer") : formatDateShort(date)}
              </h2>
              {date !== "Date à confirmer" && (
                <div className="flex gap-2">
                  <ButtonLink href={`/partage/essayages/${token}/planning?date=${date}&lang=${lang}`} variant="secondary">
                    {t(lang, "telecharger_planning")}
                  </ButtonLink>
                  <ButtonLink href={`/partage/essayages/${token}/fiches?date=${date}&lang=${lang}`} variant="secondary">
                    {t(lang, "telecharger_fiches")}
                  </ButtonLink>
                </div>
              )}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="py-2 pr-4 font-medium">{t(lang, "col_photo")}</th>
                  <th className="py-2 pr-4 font-medium">{t(lang, "col_figurant")}</th>
                  <th className="py-2 pr-4 font-medium">{t(lang, "col_fonction")}</th>
                  <th className="py-2 pr-4 font-medium">{t(lang, "col_cachet")}</th>
                  <th className="py-2 pr-4 font-medium">{t(lang, "col_costume")}</th>
                  <th className="py-2 pr-4 font-medium">{t(lang, "col_dates_tournage")}</th>
                  <th className="py-2 pr-4 font-medium">{t(lang, "col_lieu")}</th>
                  <th className="py-2 pr-4 font-medium">{t(lang, "col_statut")}</th>
                  <th className="py-2 pr-4 font-medium">{t(lang, "col_notes")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map(({ row: e, slotLabel: label, showSlotHeader, slotNumber }) => {
                  const portrait = e.figurants ? pickPortrait(photosByFigurant.get(e.figurants.id), projet.id) : null;
                  const cf = e.figurants ? cachetFonctionByFigurant.get(e.figurants.id) : null;
                  const fonction = cf?.fonction;
                  const cachet = cf?.cachet;
                  const tournageDates = e.figurants ? bookingDatesByFigurant.get(e.figurants.id) ?? [] : [];
                  return (
                    <Fragment key={e.id}>
                      {showSlotHeader && (
                        <tr>
                          <td colSpan={COLUMN_COUNT} className="pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-coral first:pt-0">
                            {t(lang, "creneau")} {slotNumber} : {label}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-border last:border-0">
                        <td className="py-2 pr-4">
                          <div className="relative h-12 w-9 overflow-hidden rounded bg-ink-raised-2">
                            {portrait?.url && (
                              <Image src={portrait.url} alt="" fill className="object-cover" unoptimized />
                            )}
                          </div>
                        </td>
                        <td className="py-2 pr-4 font-medium">
                          #{e.numero} {e.figurants ? `${e.figurants.prenom} ${e.figurants.nom}` : "—"}
                        </td>
                        <td className="py-2 pr-4 text-text-muted">{fonction ?? "—"}</td>
                        <td className="py-2 pr-4 text-text-muted">{tCachet(lang, cachet ?? null) ?? "—"}</td>
                        <td className="py-2 pr-4">
                          {e.numero_costume ? <Badge tone="coral">{e.numero_costume}</Badge> : <span className="text-text-muted">—</span>}
                        </td>
                        <td className="py-2 pr-4 text-text-muted">
                          {tournageDates.length > 0
                            ? tournageDates.map((b) => formatDateShort(b.date)).join(", ")
                            : "—"}
                        </td>
                        <td className="py-2 pr-4 text-text-muted">{e.lieu ?? "—"}</td>
                        <td className="py-2 pr-4">
                          <Badge tone={e.statut === "fait" ? "turquoise" : e.statut === "confirmé" ? "coral" : "yellow"}>
                            {tStatut(lang, e.statut)}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-text-muted">{e.notes ?? "—"}</td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ))}
        {groups.length === 0 && <p className="text-sm text-text-muted">{t(lang, "aucun_essayage")}</p>}
      </div>
    </div>
  );
}
