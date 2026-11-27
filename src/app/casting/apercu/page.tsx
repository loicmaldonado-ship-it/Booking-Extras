import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { ProjetPicker } from "@/components/bookings/projet-picker";
import { getCurrentProjetId } from "@/lib/projet-context";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { getCastingRoles, getCastingEntries, getCastingVideoUrlPairsByEntries, getCastingEntryPhotos } from "@/lib/casting/data";
import { getPhotosByFigurantId } from "@/lib/documents/data";
import { vignetteCasting } from "@/lib/casting/vignette";
import { getReelOptions, type OptionsReel } from "@/lib/partage/data";
import { computeAge } from "@/lib/documents/fields";
import { nomComplet } from "@/lib/noms";
import { clePhotoReel, cleVideoReel, mensurationsDe, photosDuProfil } from "@/lib/casting/reel-affichage";
import { CATEGORIE_CACHET_LABELS, type CategorieCachet } from "@/lib/casting/types";
import { ApercuReel, type ApercuBloc, type ApercuProfil } from "@/components/casting/apercu-reel";
import { cn } from "@/lib/cn";
import { Eye } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORIES: CategorieCachet[] = ["role", "silhouette", "doublure"];

const LIBELLES_MENSURATION: Record<string, string> = {
  mens_taille: "Taille",
  mens_poids: "Poids",
  mens_pointure: "Pointure",
  mens_veste: "Veste",
  mens_pantalon: "Pantalon",
};

// Aperçu du lien réal : exactement ce que le·la réal verra (mêmes rôles, mêmes
// profils visibles, mêmes infos cochées), avec en plus, pour l'équipe, de quoi
// retirer ou remettre une photo ou une vidéo du lien sans rien supprimer.
export default async function ApercuReelPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const projetId = await getCurrentProjetId();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;

  async function projets() {
    let q = supabase.from("projets").select("id, nom, confidentiel").eq("archive", false).order("nom");
    if (accessibleIds !== null) q = q.in("id", idsOrNone(accessibleIds));
    return (await q).data ?? [];
  }
  if (!projetId || (!isOwner(profile) && accessibleIds !== null && !accessibleIds.includes(projetId))) {
    return <ProjetPicker projets={await projets()} redirectTo="/casting/apercu" sectionLabel="Casting" />;
  }
  const { data: projet } = await supabase.from("projets").select("nom").eq("id", projetId).single();
  if (!projet) return <ProjetPicker projets={await projets()} redirectTo="/casting/apercu" sectionLabel="Casting" />;

  // Un lien par catégorie, ou « tout le casting » : le même choix que dans « Partager au réal ».
  const categorie: CategorieCachet | null = CATEGORIES.find((c) => c === params.cat) ?? null;
  const [roles, entries, options] = await Promise.all([
    getCastingRoles(projetId, categorie),
    getCastingEntries(projetId),
    getReelOptions({ projetId, categorie }),
  ]);

  // Même règle que le lien public : c'est l'équipe qui décide, rôle par rôle et profil par profil.
  const rolesVisibles = CATEGORIES.flatMap((c) => roles.filter((r) => r.visible_partage && r.categorie_cachet === c));
  const idsRoles = new Set(rolesVisibles.map((r) => r.id));
  const entriesVisibles = entries.filter((e) => e.visible_partage && idsRoles.has(e.role_id));

  const [photosByFigurant, videoPairs, entryPhotos] = await Promise.all([
    getPhotosByFigurantId(entriesVisibles.map((e) => e.figurant_id)),
    getCastingVideoUrlPairsByEntries(
      entriesVisibles.map((e) => ({ id: e.id, video_storage_paths: e.video_storage_paths, video_labels: e.video_labels }))
    ),
    getCastingEntryPhotos(entriesVisibles.map((e) => e.id)),
  ]);

  const profilDe = (entry: (typeof entriesVisibles)[number]): ApercuProfil => {
    const masques = new Set(entry.medias_masques ?? []);
    const photos = [...(entryPhotos.get(entry.id) ?? []), ...photosDuProfil(photosByFigurant.get(entry.figurant_id), projetId, "fr")];
    const infos = [
      options.age ? (computeAge(entry.figurants?.date_naissance ?? null) ? `${computeAge(entry.figurants?.date_naissance ?? null)} ans` : null) : null,
      options.ville ? entry.figurants?.ville?.trim() || null : null,
      ...mensurationsDe(entry.figurants, options).map((m) => `${LIBELLES_MENSURATION[m.cle] ?? m.cle} ${m.valeur}`),
    ].filter((x): x is string => !!x);
    const portrait = vignetteCasting(entry, photosByFigurant.get(entry.figurant_id), projetId);
    return {
      id: entry.id,
      nom: nomComplet(entry.figurants).trim(),
      valide: entry.statut === "valide",
      infos,
      reponses: options.reponses ? (entry.reponses ?? []).map((r) => `${r.question} : ${r.reponse === "oui" ? "oui" : "non"}`) : [],
      portrait,
      medias: [
        ...(videoPairs.get(entry.id) ?? []).map((v) => ({
          cle: cleVideoReel(v.path),
          type: "video" as const,
          url: v.url,
          label: v.label,
          masque: masques.has(cleVideoReel(v.path)),
        })),
        ...photos.map((p) => ({
          cle: clePhotoReel(p.id),
          type: "photo" as const,
          url: p.url,
          label: p.label,
          masque: masques.has(clePhotoReel(p.id)),
        })),
      ],
    };
  };

  const blocs: ApercuBloc[] = rolesVisibles.map((role) => ({
    id: role.id,
    nom: role.nom,
    categorie: CATEGORIE_CACHET_LABELS[role.categorie_cachet],
    profils: entriesVisibles.filter((e) => e.role_id === role.id).map(profilDe),
  }));

  const lien = (cat: CategorieCachet | null) => (cat ? `/casting/apercu?cat=${cat}` : "/casting/apercu");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Projet actuel
          <Link href="/casting" className="ml-2 text-coral hover:underline">
            ← Retour au casting
          </Link>
        </p>
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <Eye size={28} strokeWidth={1.75} />
          Aperçu du lien réal
        </h1>
        <p className="mt-1 text-text-muted">
          {projet.nom} — voilà ce que le·la réal voit sur le lien. Retire une photo ou une vidéo ici : elle disparaît du
          lien, sans être supprimée, et tu peux la remettre quand tu veux.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Lien à prévisualiser">
        {[null, ...CATEGORIES].map((c) => (
          <Link
            key={c ?? "tout"}
            href={lien(c)}
            aria-current={c === categorie ? "page" : undefined}
            className={cn(
              "rounded-full border-2 px-4 py-2 text-sm font-semibold",
              c === categorie ? "border-coral bg-coral text-ink" : "border-border-strong text-text hover:border-coral"
            )}
          >
            {c ? `${CATEGORIE_CACHET_LABELS[c]}s` : "Tout le casting"}
          </Link>
        ))}
      </nav>

      <ReglagesLien options={options} />

      <ApercuReel blocs={blocs} />
    </div>
  );
}

// Ce que le lien montre ou cache, en un coup d'œil (réglé dans « Partager au réal »).
function ReglagesLien({ options }: { options: OptionsReel }) {
  const lignes: [string, boolean][] = [
    ["Âge", options.age],
    ["Ville", options.ville],
    ["Taille", options.taille],
    ["Autres mensurations", options.mensurations],
    ["Réponses aux questions", options.reponses],
    ["Avis Oui / Peut-être / Non", options.avis],
    ["Commentaires par profil", options.commentairesProfil],
  ];
  return (
    <Card className="flex flex-wrap items-center gap-2 p-4">
      <span className="text-sm font-semibold">Réglages de ce lien :</span>
      {lignes.map(([nom, actif]) => (
        <span
          key={nom}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium",
            actif ? "border-turquoise/60 bg-turquoise/10 text-turquoise" : "border-border-strong text-text-muted line-through"
          )}
        >
          {nom}
        </span>
      ))}
      <span className="w-full text-xs text-text-muted">
        Ils se changent dans « Partager au réal », sur la page Casting. Nom, vidéos et photos sont toujours montrés.
      </span>
    </Card>
  );
}
