import { resolvePartageToken, getPartageTitreByToken, getCastingDocsVisibilityByToken } from "@/lib/partage/data";
import {
  getCastingRoles,
  getCastingEntries,
  getCastingVideoUrlPairsByEntries,
  getCastingEntryPhotos,
} from "@/lib/casting/data";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { Card, Badge } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { CastingRealEntryCard, type CastingRealEntryItem } from "@/components/casting/casting-real-entry-card";
import { LangToggle } from "@/components/partage/lang-toggle";
import { t, parseLang } from "@/lib/i18n/partage";
import { computeAge } from "@/lib/documents/fields";
import { getDocumentTemplate } from "@/lib/documents/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CastingEntry } from "@/lib/casting/types";
import { formatDateLong, formatDateShort } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";

export default async function PartageCastingPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { token } = await params;
  const lang = parseLang((await searchParams).lang);
  const projet = await resolvePartageToken(token, "casting");

  if (!projet) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t(lang, "lien_introuvable")}</h1>
        <p className="text-text-muted">{t(lang, "lien_invalide")}</p>
      </div>
    );
  }

  const [roles, entries, titre, docsVisibility, documentTemplate] = await Promise.all([
    getCastingRoles(projet.id),
    getCastingEntries(projet.id),
    getPartageTitreByToken(token, "casting"),
    getCastingDocsVisibilityByToken(token),
    getDocumentTemplate(createAdminClient(), projet.id),
  ]);
  // Le staff décide seul de la visibilité — dès qu'un profil ou un rôle est
  // coché visible, il apparaît, même sans vidéo envoyée ou sans aucun
  // profil dedans pour l'instant (pas de condition automatique en plus du
  // choix du staff).
  const visibleEntries = entries.filter((e) => e.visible_partage);

  const entriesByRole = new Map<string, typeof visibleEntries>();
  for (const e of visibleEntries) {
    const list = entriesByRole.get(e.role_id) ?? [];
    list.push(e);
    entriesByRole.set(e.role_id, list);
  }
  const rolesAvecProfils = roles.filter((r) => r.visible_partage);

  const entryIds = visibleEntries.map((e) => e.id);
  const figurantIds = visibleEntries.map((e) => e.figurant_id);
  const [photosByFigurant, videoPairsByEntry, entryPhotosByEntry] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    getCastingVideoUrlPairsByEntries(
      visibleEntries.map((e) => ({ id: e.id, video_storage_paths: e.video_storage_paths, video_labels: e.video_labels }))
    ),
    getCastingEntryPhotos(entryIds),
  ]);
  const videoUrlsByEntry = new Map(
    visibleEntries.map((e) => [e.id, (videoPairsByEntry.get(e.id) ?? []).map((p) => ({ url: p.url, label: p.label }))])
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="flex items-center justify-between gap-3">
          <Logo iconSize={26} textClassName="text-lg" />
          <LangToggle lang={lang} basePath={`/partage/casting/${token}`} />
        </div>
        {(documentTemplate.logoUrl || projet.societe_production) && (
          <div className="mt-5 flex items-center gap-3">
            {documentTemplate.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- logo de la production (URL signée)
              <img src={documentTemplate.logoUrl} alt={projet.societe_production ?? ""} className="h-14 w-auto max-w-[220px] object-contain" />
            )}
            {projet.societe_production && (
              <span className="text-sm font-semibold uppercase tracking-wide text-text-muted">{projet.societe_production}</span>
            )}
          </div>
        )}
        <h1 className="mt-4 text-2xl font-semibold">{titre || `Casting — ${projetNomPublic(projet)}`}</h1>
        <p className="mt-1 text-sm text-text-muted">{t(lang, "clique_profil")}</p>
        {(docsVisibility.listeArtistique || docsVisibility.fichesRoles || docsVisibility.distribution) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {docsVisibility.listeArtistique && (
              <a
                href={`/partage/casting/${token}/liste-artistique`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-coral/60 bg-coral/10 px-3 py-1.5 text-xs font-medium text-coral hover:bg-coral/20"
              >
                📋 Liste artistique
              </a>
            )}
            {docsVisibility.fichesRoles && (
              <a
                href={`/partage/casting/${token}/fiches-roles`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-coral/60 bg-coral/10 px-3 py-1.5 text-xs font-medium text-coral hover:bg-coral/20"
              >
                🪪 Fiches rôles validés
              </a>
            )}
            {docsVisibility.distribution && (
              <a
                href={`/partage/casting/${token}/distribution`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-coral/60 bg-coral/10 px-3 py-1.5 text-xs font-medium text-coral hover:bg-coral/20"
              >
                🎬 Distribution
              </a>
            )}
          </div>
        )}
      </div>

      {rolesAvecProfils.map((role) => {
        const roleEntries = entriesByRole.get(role.id) ?? [];
        return (
          <Card key={role.id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">{role.nom}</h2>
              <div className="flex flex-wrap items-center gap-2">
                {role.date_tournage && (
                  <Badge>
                    {role.date_tournage_fin && role.date_tournage_fin !== role.date_tournage
                      ? t(lang, "tournage_du_au", {
                          debut: formatDateShort(role.date_tournage),
                          fin: formatDateShort(role.date_tournage_fin),
                        })
                      : formatDateLong(role.date_tournage, lang === "en" ? "en-US" : "fr-FR")}
                  </Badge>
                )}
                {(role.categorie_cachet === "silhouette" || role.categorie_cachet === "doublure") &&
                  roleEntries.length > 0 && (
                    <a
                      href={`/partage/casting/${token}/fiches-mensuration?role=${role.id}${lang === "en" ? "&lang=en" : ""}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-coral/60 bg-coral/10 px-3 py-1.5 text-xs font-medium text-coral hover:bg-coral/20"
                    >
                      📏 {t(lang, "fiches_mensuration_titre")}
                    </a>
                  )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {(() => {
                const items: CastingRealEntryItem[] = roleEntries.map((entry) => ({
                  id: entry.id,
                  nom: `${entry.figurants?.prenom ?? ""} ${entry.figurants?.nom ?? ""}`.trim(),
                  valide: entry.statut === "valide",
                  portraitUrl: pickPortrait(photosByFigurant.get(entry.figurant_id), projet.id)?.url ?? null,
                  videoUrls: videoUrlsByEntry.get(entry.id) ?? [],
                  photos: [
                    ...(entryPhotosByEntry.get(entry.id) ?? []),
                    ...photosDuProfil(photosByFigurant.get(entry.figurant_id), projet.id, lang),
                  ],
                  age: computeAge(entry.figurants?.date_naissance ?? null),
                  mensurations: mensurationsDe(entry.figurants),
                  reponses: entry.reponses ?? [],
                }));
                return items.map((item, i) => (
                  <CastingRealEntryCard key={item.id} items={items} index={i} lang={lang} />
                ));
              })()}
              {roleEntries.length === 0 && (
                <p className="text-sm text-text-muted">{t(lang, "aucun_profil_disponible")}</p>
              )}
            </div>
          </Card>
        );
      })}

      {rolesAvecProfils.length === 0 && <p className="text-text-muted">{t(lang, "aucun_profil_disponible")}</p>}
    </div>
  );
}

// Mensurations montrées au·à la réal (seulement celles renseignées).
function mensurationsDe(f: CastingEntry["figurants"]): CastingRealEntryItem["mensurations"] {
  if (!f) return [];
  const liste: CastingRealEntryItem["mensurations"] = [];
  if (f.taille_cm) liste.push({ cle: "mens_taille", valeur: `${f.taille_cm} cm` });
  if (f.poids_kg) liste.push({ cle: "mens_poids", valeur: `${f.poids_kg} kg` });
  if (f.pointure) liste.push({ cle: "mens_pointure", valeur: String(Number(f.pointure)) });
  if (f.veste) liste.push({ cle: "mens_veste", valeur: f.veste });
  if (f.pantalon) liste.push({ cle: "mens_pantalon", valeur: f.pantalon });
  return liste;
}

// Photos du profil (portrait, en pied, selfie…), montrées au·à la réal en
// plus de celles envoyées pour le casting. Les essayages d'autres projets
// et les photos de véhicule restent de côté.
const LIBELLES_PHOTO: Record<string, { fr: string; en: string }> = {
  portrait: { fr: "Portrait", en: "Portrait" },
  pied: { fr: "En pied", en: "Full length" },
  selfie: { fr: "Selfie", en: "Selfie" },
  autre: { fr: "Photo", en: "Photo" },
  tenue: { fr: "Essayage", en: "Fitting" },
};
function photosDuProfil(
  photos: { type: string; url: string | null; projet_id: string | null }[] | undefined,
  projetId: string,
  lang: "fr" | "en"
): { label: string; url: string }[] {
  return (photos ?? [])
    .filter((p) => p.url && p.type in LIBELLES_PHOTO && (p.type !== "tenue" || p.projet_id === projetId))
    .map((p) => ({ label: LIBELLES_PHOTO[p.type][lang], url: p.url! }));
}
