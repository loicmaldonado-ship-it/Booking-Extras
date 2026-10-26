import { nomComplet } from "@/lib/noms";
import { PresencePartage } from "@/components/partage/presence-partage";
import { resolvePartageToken, getPartageTitreByToken, getCastingDocsVisibilityByToken, getCategorieLienCasting, getReelOptions, type OptionsReel } from "@/lib/partage/data";
import {
  getCastingRoles,
  getCastingEntries,
  getCastingVideoUrlPairsByEntries,
  getCastingEntryPhotos,
} from "@/lib/casting/data";
import { getPhotosByFigurantId } from "@/lib/documents/data";
import { vignetteCasting } from "@/lib/casting/vignette";
import { Badge } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { CastingRealEntryCard, type CastingRealEntryItem } from "@/components/casting/casting-real-entry-card";
import { ReelProvider } from "@/components/casting/reel-context";
import { LangToggle } from "@/components/partage/lang-toggle";
import { t, parseLang } from "@/lib/i18n/partage";
import { computeAge } from "@/lib/documents/fields";
import { getDocumentTemplate } from "@/lib/documents/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORIE_CACHET_LABELS, type CastingEntry, type CategorieCachet } from "@/lib/casting/types";
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

  // Lien limité à une catégorie (rôles, silhouettes ou doublures), ou null
  // pour tout le casting : dans ce cas les profils sont rangés par catégorie.
  const categorieLien = await getCategorieLienCasting(token);
  const [roles, entries, titre, docsVisibility, documentTemplate, options] = await Promise.all([
    getCastingRoles(projet.id, categorieLien),
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
  const CATEGORIES: CategorieCachet[] = ["role", "silhouette", "doublure"];
  // Rangés par catégorie (rôles, puis silhouettes, puis doublures), dans
  // l'ordre voulu par l'équipe à l'intérieur de chacune.
  const rolesAvecProfils = CATEGORIES.flatMap((c) => roles.filter((r) => r.visible_partage && r.categorie_cachet === c));

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

  const dateDuRole = (role: (typeof rolesAvecProfils)[number]) =>
    role.date_tournage
      ? role.date_tournage_fin && role.date_tournage_fin !== role.date_tournage
        ? t(lang, "tournage_du_au", { debut: formatDateShort(role.date_tournage), fin: formatDateShort(role.date_tournage_fin) })
        : formatDateLong(role.date_tournage, lang === "en" ? "en-US" : "fr-FR")
      : null;

  // Un profil du lien, avec seulement ce que l'équipe a choisi de montrer.
  // Dans la section « Profils validés » (avecRole), le rôle et sa date
  // s'affichent sur chaque profil.
  const construire = (
    entry: (typeof visibleEntries)[number],
    role: (typeof rolesAvecProfils)[number],
    avecRole: boolean
  ): CastingRealEntryItem => ({
    id: entry.id,
    nom: nomComplet(entry.figurants).trim(),
    valide: entry.statut === "valide",
    role: avecRole ? role.nom : null,
    roleDate: avecRole ? dateDuRole(role) : null,
    portraitUrl: vignetteCasting(entry, photosByFigurant.get(entry.figurant_id), projet.id),
    videoUrls: videoUrlsByEntry.get(entry.id) ?? [],
    photos: [
      ...(entryPhotosByEntry.get(entry.id) ?? []),
      ...photosDuProfil(photosByFigurant.get(entry.figurant_id), projet.id, lang),
    ],
    age: options.age ? computeAge(entry.figurants?.date_naissance ?? null) : null,
    ville: options.ville ? (entry.figurants?.ville?.trim() || null) : null,
    mensurations: mensurationsDe(entry.figurants, options),
    reponses: options.reponses ? (entry.reponses ?? []) : [],
  });

  // Une sous-section par catégorie quand le lien couvre tout le casting.
  const parCategorie = (items: CastingRealEntryItem[], roleParId: Map<string, CategorieCachet>) => {
    const groupes: { cat: CategorieCachet; debut: number; items: CastingRealEntryItem[] }[] = [];
    let debut = 0;
    for (const cat of CATEGORIES) {
      const dans = items.filter((it) => roleParId.get(it.id) === cat);
      if (dans.length > 0) groupes.push({ cat, debut, items: dans });
      debut += dans.length;
    }
    return groupes;
  };
  const categorieDuProfil = new Map<string, CategorieCachet>(
    rolesAvecProfils.flatMap((role) => (entriesByRole.get(role.id) ?? []).map((e) => [e.id, role.categorie_cachet] as const))
  );

  // Profils validés de tous les rôles visibles, dans l'ordre des rôles.
  const valides = rolesAvecProfils.flatMap((role) =>
    (entriesByRole.get(role.id) ?? []).filter((e) => e.statut === "valide").map((e) => construire(e, role, true))
  );
  const enCours = rolesAvecProfils.flatMap((role) =>
    (entriesByRole.get(role.id) ?? []).filter((e) => e.statut !== "valide").map((e) => construire(e, role, true))
  );
  const groupesValides = parCategorie(valides, categorieDuProfil);
  // « Profils à valider » reste en mode casting : un bloc par rôle (nom, date)
  // avec ses profils dessous, rangés par catégorie quand le lien couvre tout.
  let debutRole = 0;
  const rolesEnCours = rolesAvecProfils.flatMap((role) => {
    const n = (entriesByRole.get(role.id) ?? []).filter((e) => e.statut !== "valide").length;
    if (n === 0) return [];
    const bloc = { role, debut: debutRole, items: enCours.slice(debutRole, debutRole + n) };
    debutRole += n;
    return [bloc];
  });
  const groupesEnCours = CATEGORIES.map((cat) => ({ cat, roles: rolesEnCours.filter((b) => b.role.categorie_cachet === cat) })).filter(
    (g) => g.roles.length > 0
  );
  const sousTitres = categorieLien === null && new Set([...groupesValides, ...groupesEnCours].map((g) => g.cat)).size > 1;
  const grille = (items: CastingRealEntryItem[], groupes: typeof groupesValides) =>
    groupes.map((g) => (
      <div key={g.cat} className="flex flex-col gap-3">
        {sousTitres && (
          <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">
            {CATEGORIE_CACHET_LABELS[g.cat]}s <span className="font-normal">({g.items.length})</span>
          </h3>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,15rem))] sm:gap-4">
          {g.items.map((item, i) => (
            <CastingRealEntryCard key={item.id} items={items} index={g.debut + i} lang={lang} afficherStatut={false} />
          ))}
        </div>
      </div>
    ));

  // Rôles visibles sans aucun profil pour l'instant : cités sous les sections.
  const rolesSansProfil = rolesAvecProfils.filter((r) => (entriesByRole.get(r.id) ?? []).length === 0);
  const rolesMensuration = (statutValide: boolean) =>
    rolesAvecProfils.filter(
      (r) =>
        (r.categorie_cachet === "silhouette" || r.categorie_cachet === "doublure") &&
        (entriesByRole.get(r.id) ?? []).some((e) => (e.statut === "valide") === statutValide)
    );
  const liensMensuration = (roles: typeof rolesAvecProfils) =>
    roles.map((role) => (
      <a
        key={role.id}
        href={`/partage/casting/${token}/fiches-mensuration?role=${role.id}${lang === "en" ? "&lang=en" : ""}`}
        target="_blank"
        rel="noreferrer"
        className="rounded-full border border-coral/60 bg-coral/10 px-3.5 py-2 text-sm font-medium text-coral hover:bg-coral/20 sm:py-1.5 sm:text-xs"
      >
        📏 {t(lang, "fiches_mensuration_titre")} — {role.nom}
      </a>
    ));

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
        <h1 className="mt-4 text-2xl font-semibold">{titre || (categorieLien ? `${CATEGORIE_CACHET_LABELS[categorieLien]}s — ${projetNomPublic(projet)}` : `Casting — ${projetNomPublic(projet)}`)}</h1>
        <p className="mt-1 text-sm text-text-muted">{t(lang, "clique_profil")}</p>
        {(docsVisibility.listeArtistique || docsVisibility.fichesRoles || docsVisibility.distribution) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {docsVisibility.listeArtistique && (
              <a
                href={`/partage/casting/${token}/liste-artistique`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-coral/60 bg-coral/10 px-3.5 py-2 text-sm font-medium text-coral hover:bg-coral/20 sm:py-1.5 sm:text-xs"
              >
                📋 Liste artistique
              </a>
            )}
            {docsVisibility.fichesRoles && (
              <a
                href={`/partage/casting/${token}/fiches-roles`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-coral/60 bg-coral/10 px-3.5 py-2 text-sm font-medium text-coral hover:bg-coral/20 sm:py-1.5 sm:text-xs"
              >
                🪪 Fiches rôles validés
              </a>
            )}
            {docsVisibility.distribution && (
              <a
                href={`/partage/casting/${token}/distribution`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-coral/60 bg-coral/10 px-3.5 py-2 text-sm font-medium text-coral hover:bg-coral/20 sm:py-1.5 sm:text-xs"
              >
                🎬 Distribution
              </a>
            )}
          </div>
        )}
      </div>

      {valides.length > 0 && (
        <section className="flex flex-col gap-4 sm:rounded-2xl sm:border sm:border-border sm:bg-ink-raised sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">
              {t(lang, "profils_valides")} <span className="text-text-muted">({valides.length})</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">{liensMensuration(rolesMensuration(true))}</div>
          </div>
          {grille(valides, groupesValides)}
        </section>
      )}

      {/* Profils pas encore validés : sous les validés, en mode casting (un
          bloc par rôle avec ses profils), tant que l'équipe ne les a pas mis
          en invisible. Le bloc s'adapte à son contenu. */}
      {enCours.length > 0 && (
        <section className="flex flex-col gap-4 sm:rounded-2xl sm:border sm:border-border sm:bg-ink-raised sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">
              {t(lang, "profils_a_valider")} <span className="text-text-muted">({enCours.length})</span>
            </h2>
            <div className="flex flex-wrap items-center gap-2">{liensMensuration(rolesMensuration(false))}</div>
          </div>
          {groupesEnCours.map((g) => (
            <div key={g.cat} className="flex flex-col gap-3">
              {sousTitres && (
                <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{CATEGORIE_CACHET_LABELS[g.cat]}s</h3>
              )}
              {g.roles.map((b) => (
                <div key={b.role.id} className="flex w-full flex-col gap-3 sm:w-fit sm:max-w-full sm:rounded-xl sm:border sm:border-border sm:bg-ink sm:p-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-2 sm:border-0 sm:pb-0">
                    <h3 className="text-lg font-semibold">{b.role.nom}</h3>
                    {dateDuRole(b.role) && <span className="text-xs text-text-muted">{dateDuRole(b.role)}</span>}
                    <span className="text-xs text-text-muted">({b.items.length})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(8.5rem,15rem))] sm:gap-4">
                    {b.items.map((item, i) => (
                      <CastingRealEntryCard key={item.id} items={enCours} index={b.debut + i} lang={lang} afficherStatut={false} masquerRole />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {rolesSansProfil.length > 0 && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
          {t(lang, "roles_a_venir")}
          {rolesSansProfil.map((r) => (
            <Badge key={r.id}>{r.nom}</Badge>
          ))}
        </p>
      )}

      {valides.length === 0 && enCours.length === 0 && rolesSansProfil.length === 0 && (
        <p className="text-text-muted">{t(lang, "aucun_profil_disponible")}</p>
      )}
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
