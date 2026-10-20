import { createAdminClient } from "@/lib/supabase/admin";
import { getModelesEquipe } from "@/lib/templates/equipe";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { ProjetPicker } from "@/components/bookings/projet-picker";
import { PartageCard } from "@/components/partage/partage-card";
import { getPartageToken, getPartageTitre } from "@/lib/partage/actions";
import { getSiteOrigin, getCastingDocsVisibility } from "@/lib/partage/data";
import { CastingDocsVisibilityToggle } from "@/components/casting/casting-docs-visibility-toggle";
import { CastingReelOptions } from "@/components/casting/casting-reel-options";
import { getReelOptions } from "@/lib/partage/data";
import { getRetourReel } from "@/lib/casting/reel-data";
import {
  getCastingRoles,
  getCastingEntries,
  getCastingVideoUrlPairsByEntries,
  getCastingEntryPhotos,
} from "@/lib/casting/data";
import { getPresentielJourneesWithCreneaux, getPresentielAssignmentsByRole } from "@/lib/casting-presentiel/journees";
import { getPhotosByFigurantId } from "@/lib/documents/data";
import { photosPourVignette, vignetteCasting } from "@/lib/casting/vignette";
import { CastingRoleSection } from "@/components/casting/casting-role-section";
import { NewCastingRoleCard } from "@/components/casting/new-casting-role-card";
import { getCurrentProjetId, setCurrentProjet } from "@/lib/projet-context";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { comedienPoolClause } from "@/lib/figurants/comedien-privacy";
import { isOwner } from "@/lib/auth/owner";
import { getProjetSignatureOrOwnerName } from "@/lib/projets/signature";
import { CASTING_MODE_LABELS, CASTING_STATUTS, CATEGORIE_CACHET_LABELS, type CategorieCachet } from "@/lib/casting/types";
import Link from "next/link";
import { Video } from "lucide-react";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function CastingPage({
  searchParams,
}: {
  searchParams: Promise<{ switch?: string; mode?: string; statut?: string; cat?: string }>;
}) {
  const params = await searchParams;
  const supabase = createAdminClient();
  const currentProjetId = await getCurrentProjetId();
  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;

  async function accessibleProjets() {
    let q = supabase.from("projets").select("id, nom, confidentiel").eq("archive", false).order("nom");
    if (accessibleIds !== null) q = q.in("id", idsOrNone(accessibleIds));
    const { data } = await q;
    return data ?? [];
  }

  if (!currentProjetId || params.switch) {
    return <ProjetPicker projets={await accessibleProjets()} redirectTo="/casting" sectionLabel="Casting" />;
  }
  if (!isOwner(profile) && accessibleIds !== null && !accessibleIds.includes(currentProjetId)) {
    return <ProjetPicker projets={await accessibleProjets()} redirectTo="/casting" sectionLabel="Casting" />;
  }

  const { data: projet } = await supabase.from("projets").select("nom, confidentiel").eq("id", currentProjetId).single();
  if (!projet) {
    return <ProjetPicker projets={await accessibleProjets()} redirectTo="/casting" sectionLabel="Casting" />;
  }

  // Onglet ouvert : une catégorie à la fois (rôles, silhouettes, doublures).
  const CATEGORIES = Object.keys(CATEGORIE_CACHET_LABELS) as CategorieCachet[];

  let allFigurantsQuery = supabase.from("figurants").select("id, prenom, nom").order("nom").order("prenom");
  const comedienClause = comedienPoolClause(profile);
  if (comedienClause) allFigurantsQuery = allFigurantsQuery.or(comedienClause);

  const [
    roles,
    entries,
    origin,
    { data: allFigurants },
    { data: templates },
    signature,
    presentielJournees,
    presentielAssignments,
    retourReel,
  ] = await Promise.all([
    getCastingRoles(currentProjetId),
    getCastingEntries(currentProjetId),
    getSiteOrigin(),
    allFigurantsQuery,
    getModelesEquipe().then((data) => ({ data })),
    getProjetSignatureOrOwnerName(supabase, currentProjetId),
    getPresentielJourneesWithCreneaux(currentProjetId),
    getPresentielAssignmentsByRole(currentProjetId),
    getRetourReel(currentProjetId),
  ]);

  const roleIdsParCategorie = new Map<CategorieCachet, Set<string>>(CATEGORIES.map((c) => [c, new Set<string>()]));
  for (const role of roles) roleIdsParCategorie.get(role.categorie_cachet)?.add(role.id);
  const categorie: CategorieCachet =
    CATEGORIES.find((c) => c === params.cat) ?? CATEGORIES.find((c) => roleIdsParCategorie.get(c)!.size > 0) ?? "role";
  const rolesCategorie = roles.filter((role) => role.categorie_cachet === categorie);
  const comptes = Object.fromEntries(
    CATEGORIES.map((c) => [
      c,
      { roles: roleIdsParCategorie.get(c)!.size, profils: entries.filter((e) => roleIdsParCategorie.get(c)!.has(e.role_id)).length },
    ])
  ) as Record<CategorieCachet, { roles: number; profils: number }>;

  // Un lien pour la catégorie ouverte, un autre pour tout le casting.
  const [liensCategorie, lienTout] = await Promise.all(
    [categorie, null].map(async (cat) => {
      const [token, titre, docs, options] = await Promise.all([
        getPartageToken(currentProjetId, "casting", cat),
        getPartageTitre(currentProjetId, "casting", cat),
        getCastingDocsVisibility(currentProjetId, cat),
        getReelOptions({ projetId: currentProjetId, categorie: cat }),
      ]);
      return { cat, token, titre, docs, options };
    })
  );

  // Filtre appliqué avant même de récupérer photos/vidéos des entrées
  // écartées — pas la peine de les signer si elles ne s'affichent pas.
  let filteredEntries = entries.filter((e) => roleIdsParCategorie.get(categorie)!.has(e.role_id));
  if (params.mode === "selftape" || params.mode === "presentiel") {
    filteredEntries = filteredEntries.filter((e) => e.mode === params.mode);
  }
  if (params.statut) filteredEntries = filteredEntries.filter((e) => e.statut === params.statut);
  const entriesFiltered = params.mode || params.statut;
  const totalCategorie = comptes[categorie].profils;

  const figurantIds = filteredEntries.map((e) => e.figurant_id);
  const entryIds = filteredEntries.map((e) => e.id);
  const [photosByFigurant, videoPairsByEntry, entryPhotosByEntry] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    getCastingVideoUrlPairsByEntries(
      filteredEntries.map((e) => ({ id: e.id, video_storage_paths: e.video_storage_paths, video_labels: e.video_labels }))
    ),
    getCastingEntryPhotos(entryIds),
  ]);
  const vignetteByEntry = new Map(
    filteredEntries.map((e) => [e.id, vignetteCasting(e, photosByFigurant.get(e.figurant_id), currentProjetId)])
  );
  const photosVignetteByEntry = new Map(
    filteredEntries.map((e) => [e.id, photosPourVignette(e, photosByFigurant.get(e.figurant_id), currentProjetId)])
  );
  const videoUrlsByEntry = new Map(filteredEntries.map((e) => [e.id, videoPairsByEntry.get(e.id) ?? []]));

  const entriesByRole = new Map<string, typeof filteredEntries>();
  for (const e of filteredEntries) {
    const list = entriesByRole.get(e.role_id) ?? [];
    list.push(e);
    entriesByRole.set(e.role_id, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Projet actuel
            <a href="/casting?switch=1" className="ml-2 text-coral hover:underline">
              Changer de projet
            </a>
          </p>
          <h1 className="flex items-center gap-2 text-3xl font-semibold">
            <Video size={28} strokeWidth={1.75} />
            {projet.nom}
          </h1>
          <p className="mt-1 text-text-muted">
            {rolesCategorie.length} casting{rolesCategorie.length > 1 ? "s" : ""} · {filteredEntries.length} profil
            {filteredEntries.length > 1 ? "s" : ""}
            {entriesFiltered ? ` sur ${totalCategorie}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <ButtonLink
            href="/figurants?profil=comediens&vue=liste"
            variant="secondary"
            title="Ta base privée : comédien·nes et personnes venues par un lien de casting sans compte"
          >
            📇 Base casting
          </ButtonLink>
          <ButtonLink href="/casting/trombis" variant="secondary">
            🖼️ Trombis
          </ButtonLink>
          <ButtonLink href="/casting/presentiel" variant="secondary">
            📅 Présentiel
          </ButtonLink>
          <ButtonLink href="/casting/liste-artistique" variant="secondary">
            📋 Liste artistique
          </ButtonLink>
          <ButtonLink href="/casting/fiches-roles" variant="secondary">
            🪪 Fiches rôles validés
          </ButtonLink>
          <ButtonLink href="/casting/distribution" variant="secondary">
            🎬 Distribution
          </ButtonLink>
          <form action={setCurrentProjet.bind(null, currentProjetId, "/bookings")}>
            <Button type="submit" variant="secondary">
              📋 Bookings
            </Button>
          </form>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Catégories de casting">
        {CATEGORIES.map((c) => {
          const actif = c === categorie;
          return (
            <Link
              key={c}
              href={`/casting?cat=${c}`}
              aria-current={actif ? "page" : undefined}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-semibold",
                actif ? "border-coral bg-coral text-ink" : "border-border-strong text-text hover:border-coral"
              )}
            >
              {CATEGORIE_CACHET_LABELS[c]}s · {comptes[c].profils}
            </Link>
          );
        })}
      </nav>

      {/* Filtres en boutons : un clic et c'est appliqué. */}
      {[
        {
          cle: "mode" as const,
          titre: "Mode",
          options: [
            { value: "selftape", label: CASTING_MODE_LABELS.selftape },
            { value: "presentiel", label: CASTING_MODE_LABELS.presentiel },
          ],
        },
        { cle: "statut" as const, titre: "Statut", options: CASTING_STATUTS.map((s) => ({ value: s.value as string, label: s.label })) },
      ].map((groupe) => {
        const actuel = params[groupe.cle] ?? "";
        const lien = (valeur: string) => {
          const sp = new URLSearchParams({ cat: categorie });
          const autre = groupe.cle === "mode" ? "statut" : "mode";
          if (params[autre]) sp.set(autre, params[autre]!);
          if (valeur) sp.set(groupe.cle, valeur);
          return `/casting?${sp.toString()}`;
        };
        return (
          <div key={groupe.cle} className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{groupe.titre} :</span>
            {[{ value: "", label: "Tous" }, ...groupe.options].map((o) => (
              <Link
                key={o.value || "tous"}
                href={lien(o.value)}
                aria-pressed={actuel === o.value}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold",
                  actuel === o.value ? "border-coral bg-coral text-ink" : "border-border-strong text-text hover:border-coral"
                )}
              >
                {o.label}
              </Link>
            ))}
          </div>
        );
      })}
      {entriesFiltered && (
        <Link href={`/casting?cat=${categorie}`} className="text-sm font-medium text-text hover:text-coral">
          Réinitialiser les filtres
        </Link>
      )}

      <NewCastingRoleCard projetId={currentProjetId} categorie={categorie} />

      {rolesCategorie.map((role, i) => (
        <CastingRoleSection
          key={role.id}
          projetId={currentProjetId}
          projetNom={projet.nom}
          origin={origin}
          signature={signature}
          role={role}
          entries={entriesByRole.get(role.id) ?? []}
          vignetteByEntry={vignetteByEntry}
          photosVignetteByEntry={photosVignetteByEntry}
          videoUrlsByEntry={videoUrlsByEntry}
          entryPhotosByEntry={entryPhotosByEntry}
          allFigurants={allFigurants ?? []}
          templates={templates ?? []}
          presentielJournees={presentielJournees}
          presentielAssignments={presentielAssignments.get(role.id) ?? new Map()}
          avisReelByEntry={retourReel.avisParEntry}
          commentairesReelByEntry={retourReel.commentairesParEntry}
          position={i + 1}
        />
      ))}

      {rolesCategorie.length === 0 && (
        <Card>
          <p className="text-sm text-text-muted">
            Aucun casting dans « {CATEGORIE_CACHET_LABELS[categorie]}s » pour l&apos;instant — crée-en un ci-dessus, ou
            envoie une sélection depuis Base Profils, Bookings ou Candidatures (bouton « Envoyer au casting »).
          </p>
        </Card>
      )}

      {[liensCategorie, lienTout].map((lien) => (
        <PartageCard
          key={lien.cat ?? "tout"}
          projetId={currentProjetId}
          type="casting"
          categorie={lien.cat}
          label={
            lien.cat
              ? `Partage réal — ${CATEGORIE_CACHET_LABELS[lien.cat]}s « ${projet.nom} »`
              : `Partage réal — Tout le casting « ${projet.nom} »`
          }
          description={
            lien.cat
              ? `Lien séparé : uniquement les ${CATEGORIE_CACHET_LABELS[lien.cat].toLowerCase()}s, classées par rôle.`
              : "Un seul lien pour les rôles, les silhouettes et les doublures, rangés par catégorie."
          }
          token={lien.token}
          publicBaseUrl={`${origin}/partage/casting`}
          titre={lien.titre}
          titrePlaceholder={lien.cat ? `${CATEGORIE_CACHET_LABELS[lien.cat]}s — ${projet.nom}` : `Casting — ${projet.nom}`}
        >
          <CastingDocsVisibilityToggle
            projetId={currentProjetId}
            categorie={lien.cat}
            listeArtistique={lien.docs.listeArtistique}
            fichesRoles={lien.docs.fichesRoles}
            distribution={lien.docs.distribution}
            fichesRolesMasquerContact={lien.docs.fichesRolesMasquerContact}
          />
          <CastingReelOptions projetId={currentProjetId} categorie={lien.cat} options={lien.options} />
        </PartageCard>
      ))}
    </div>
  );
}
