import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PrintSheet } from "@/components/documents/print-sheet";
import { PrintButton } from "@/components/documents/print-button";
import { DownloadPdfButton } from "@/components/documents/download-pdf-button";
import { MensurationSheet } from "@/components/documents/mensuration-sheet";
import { DocumentLetterhead } from "@/components/documents/letterhead";
import { getDocumentTemplate } from "@/lib/documents/templates";
import { getPhotosDocumentsProjet } from "@/lib/documents/photos-projet";
import { computeAge } from "@/lib/documents/fields";
import { resolvePartageToken } from "@/lib/partage/data";
import { getCastingRoles } from "@/lib/casting/data";
import { projetNomPublic } from "@/lib/projets/types";
import { t, parseLang } from "@/lib/i18n/partage";
import type { Figurant } from "@/lib/figurants/types";

export const dynamic = "force-dynamic";

// Fiches mensuration d'un rôle silhouette / doublure sur le lien réal :
// ajoutées d'office pour ces rôles (pas d'interrupteur). Fiches muettes —
// ni téléphone ni email — avec âge et ville.
export default async function PartageCastingFichesMensurationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ role?: string; lang?: string }>;
}) {
  const { token } = await params;
  const { role: roleId, lang: langParam } = await searchParams;
  const lang = parseLang(langParam);
  const projet = await resolvePartageToken(token, "casting");
  const roles = projet ? await getCastingRoles(projet.id) : [];
  const role = roles.find((r) => r.id === roleId);

  if (!projet || !role || !role.visible_partage || !["silhouette", "doublure"].includes(role.categorie_cachet)) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Document indisponible</h1>
        <p className="text-text-muted">Ce document n&apos;est pas (ou plus) partagé sur ce lien.</p>
      </div>
    );
  }

  const supabase = createAdminClient();
  const { data: entrees } = await supabase
    .from("casting_entries")
    .select("figurant_id, created_at, figurants(*)")
    .eq("role_id", role.id)
    .eq("visible_partage", true)
    .order("created_at")
    .returns<{ figurant_id: string; figurants: Figurant | null }[]>();
  const fiches = (entrees ?? []).filter((e): e is { figurant_id: string; figurants: Figurant } => !!e.figurants);
  const [documentTemplate, photos] = await Promise.all([
    getDocumentTemplate(supabase, projet.id),
    getPhotosDocumentsProjet(projet.id, fiches.map((f) => f.figurant_id)),
  ]);
  const nom = projetNomPublic(projet);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/partage/casting/${token}${lang === "en" ? "?lang=en" : ""}`}
        className="print-hide inline-flex items-center gap-1 text-sm text-text-muted hover:text-coral"
      >
        ← {nom}
      </Link>
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          {t(lang, "fiches_mensuration_titre")} — {role.nom}
        </h1>
        <div className="flex gap-3">
          <DownloadPdfButton filename={`fiches-mensuration-${role.nom}.pdf`} orientation="landscape" />
          <PrintButton />
        </div>
      </div>

      {fiches.length === 0 && (
        <PrintSheet orientation="landscape">
          <p className="py-6 text-center text-gray-500">{t(lang, "aucun_profil_disponible")}</p>
        </PrintSheet>
      )}

      {fiches.map(({ figurant_id, figurants: f }) => {
        const age = computeAge(f.date_naissance);
        const infos = [age !== null ? t(lang, "age_ans", { n: String(age) }) : null, f.ville].filter(Boolean);
        return (
          <PrintSheet key={figurant_id} orientation="landscape">
            <div className="break-after-page">
              <DocumentLetterhead
                societe={projet.societe_production ?? null}
                filmNom={nom}
                dateLabel={`Casting · ${role.nom}`}
                realisateur={projet.realisateur}
                logoUrl={documentTemplate.logoUrl}
                accentColor={documentTemplate.accentColor}
              />
              <MensurationSheet
                figurant={f}
                photos={photos.get(figurant_id) ?? []}
                header={infos.length > 0 ? <p className="text-sm text-gray-600">{infos.join(" · ")}</p> : null}
                lang={lang}
              />
            </div>
          </PrintSheet>
        );
      })}
    </div>
  );
}
