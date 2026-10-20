import { nomComplet } from "@/lib/noms";
import { PresencePartage } from "@/components/partage/presence-partage";
import { resolvePartageToken, getPartageTitreByToken, getCastingDocsVisibilityByToken, getReelOptions, type OptionsReel } from "@/lib/partage/data";
import {
  getCastingRoles,
  getCastingEntries,
  getCastingVideoUrlPairsByEntries,
  getCastingEntryPhotos,
} from "@/lib/casting/data";
import { getPhotosByFigurantId } from "@/lib/documents/data";
import { vignetteCasting } from "@/lib/casting/vignette";
import { Card, Badge } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { CastingRealEntryCard, type CastingRealEntryItem } from "@/components/casting/casting-real-entry-card";
import { ReelProvider } from "@/components/casting/reel-context";
import { LangToggle } from "@/components/partage/lang-toggle";
import { t, parseLang } from "@/lib/i18n/partage";
import { computeAge } from "@/lib/documents/fields";
import { getDocumentTemplate } from "@/lib/documents/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CastingEntry } from "@/lib/casting/types";
import { formatDateLong, formatDateShort } from "@/lib/format-date";
import { projetNomPublic } from "@/lib/projets/types";

// Salle de visionnage : thème sombre propre à cette page (les couleurs du site
// sont des variables, redéfinies ici seulement ; la fenêtre de profil, rendue
// dans le body, en profite aussi). On regarde des vidéos : le fond sombre
// laisse les images ressortir sans tomber dans le noir : un violet profond.
const THEME_SOMBRE = `
:root {
  --color-ink: #2b2147;
  --color-ink-raised: #382c5c;
  --color-ink-raised-2: #45386d;
  --color-border: #5a4b85;
  --color-border-strong: #a393cf;
  --color-text: #f6f2ff;
  --color-text-muted: #cdc3e6;
  --color-coral: #b9d4ad;
  --color-coral-hover: #cde2c3;
  --color-turquoise: #6fdc9a;
  --color-yellow: #f5c05c;
  --color-danger: #ff9a9a;
  --color-danger-hover: #ffb4b4;
  color-scheme: dark;
}
html body { background: linear-gradient(160deg, #3a2c63 0%, #2f2352 55%, #271c47 100%) fixed; }
.logo-sombre span[style] { color: #f1eaff !important; }
`;

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

  const [roles, entries, titre, docsVisibility, documentTemplate, options] = await Promise.all([
    getCastingRoles(projet.id),
    getCastingEntries(projet.id),
    getPartageTitreByToken(token, "casting"),
    getCastingDocsVisibilityByToken(token),
    getDocumentTemplate(createAdminClient(), projet.id),
    getReelOptions({ token }),
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
    <ReelProvider token={token} lang={lang} avisActifs={options.avis} commentairesActifs={options.commentairesProfil}>
    <style>{THEME_SOMBRE}</style>
    <div className="flex flex-col gap-8">
      <PresencePartage token={token} demander="commentaire" lang={lang} />
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="logo-sombre">
            <Logo iconSize={26} textClassName="text-lg" />
          </span>
          <LangToggle lang={lang} basePath={`/partage/casting/${token}`} />
        </div>
        {(documentTemplate.logoUrl || projet.societe_production) && (
          <div className="mt-5 flex items-center gap-3">
            {documentTemplate.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- logo de la production (URL signée)
              <img
                src={documentTemplate.logoUrl}
                alt={projet.societe_production ?? ""}
                className="h-14 w-auto max-w-[220px] rounded-lg bg-white object-contain p-1.5"
              />
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
        // Sur grand écran, le cadre du rôle épouse ses profils (un seul profil =
        // un petit cadre, pas une bande pleine largeur) ; sur téléphone, pleine largeur.
        return (
          <Card key={role.id} className="flex flex-col gap-4 sm:w-fit sm:min-w-[20rem] sm:max-w-full">
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

            <div className="flex flex-wrap gap-3 sm:gap-4">
              {(() => {
                const items: CastingRealEntryItem[] = roleEntries.map((entry) => ({
                  id: entry.id,
                  nom: nomComplet(entry.figurants).trim(),
                  valide: entry.statut === "valide",
                  portraitUrl: vignetteCasting(entry, photosByFigurant.get(entry.figurant_id), projet.id),
                  videoUrls: videoUrlsByEntry.get(entry.id) ?? [],
                  photos: [
                    ...(entryPhotosByEntry.get(entry.id) ?? []),
                    ...photosDuProfil(photosByFigurant.get(entry.figurant_id), projet.id, lang),
                  ],
                  // Seulement ce que l'équipe a choisi de montrer sur ce lien.
                  age: options.age ? computeAge(entry.figurants?.date_naissance ?? null) : null,
                  ville: options.ville ? (entry.figurants?.ville?.trim() || null) : null,
                  mensurations: mensurationsDe(entry.figurants, options),
                  reponses: options.reponses ? (entry.reponses ?? []) : [],
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
    </ReelProvider>
  );
}

// Mensurations montrées au·à la réal (seulement celles renseignées).
function mensurationsDe(f: CastingEntry["figurants"], options: OptionsReel): CastingRealEntryItem["mensurations"] {
  if (!f) return [];
  const liste: CastingRealEntryItem["mensurations"] = [];
  if (options.taille && f.taille_cm) liste.push({ cle: "mens_taille", valeur: `${f.taille_cm} cm` });
  if (options.mensurations) {
    if (f.poids_kg) liste.push({ cle: "mens_poids", valeur: `${f.poids_kg} kg` });
    if (f.pointure) liste.push({ cle: "mens_pointure", valeur: String(Number(f.pointure)) });
    if (f.veste) liste.push({ cle: "mens_veste", valeur: f.veste });
    if (f.pantalon) liste.push({ cle: "mens_pantalon", valeur: f.pantalon });
  }
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
