import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { Button, ButtonLink } from "@/components/ui/button";
import { ProjetPicker } from "@/components/bookings/projet-picker";
import { PartageCard } from "@/components/partage/partage-card";
import { getPartageToken, getPartageTitre } from "@/lib/partage/actions";
import { getSiteOrigin, getCastingDocsVisibility } from "@/lib/partage/data";
import { CastingDocsVisibilityToggle } from "@/components/casting/casting-docs-visibility-toggle";
import {
  getCastingRoles,
  getCastingEntries,
  getCastingVideoUrlPairsByEntries,
  getCastingEntryPhotos,
} from "@/lib/casting/data";
import { getPresentielJourneesWithCreneaux, getPresentielAssignmentsByRole } from "@/lib/casting-presentiel/journees";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { CastingRoleSection } from "@/components/casting/casting-role-section";
import { NewCastingRoleCard } from "@/components/casting/new-casting-role-card";
import { getCurrentProjetId, setCurrentProjet } from "@/lib/projet-context";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { comedienPoolClause } from "@/lib/figurants/comedien-privacy";
import { isOwner } from "@/lib/auth/owner";
import { getProjetSignatureOrOwnerName } from "@/lib/projets/signature";
import { CASTING_MODE_LABELS, CASTING_STATUTS } from "@/lib/casting/types";
import { Select } from "@/components/ui/field";
import Link from "next/link";
import type { MessageTemplate } from "@/lib/templates/types";
import { Video } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CastingPage({
  searchParams,
}: {
  searchParams: Promise<{ switch?: string; mode?: string; statut?: string }>;
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

  let allFigurantsQuery = supabase.from("figurants").select("id, prenom, nom").order("nom");
  const comedienClause = comedienPoolClause(profile);
  if (comedienClause) allFigurantsQuery = allFigurantsQuery.or(comedienClause);

  const [
    roles,
    entries,
    partageToken,
    partageTitre,
    docsVisibility,
    origin,
    { data: allFigurants },
    { data: templates },
    signature,
    presentielJournees,
    presentielAssignments,
  ] = await Promise.all([
    getCastingRoles(currentProjetId),
    getCastingEntries(currentProjetId),
    getPartageToken(currentProjetId, "casting"),
    getPartageTitre(currentProjetId, "casting"),
    getCastingDocsVisibility(currentProjetId),
    getSiteOrigin(),
    allFigurantsQuery,
    supabase.from("message_templates").select("*").order("nom").returns<MessageTemplate[]>(),
    getProjetSignatureOrOwnerName(supabase, currentProjetId),
    getPresentielJourneesWithCreneaux(currentProjetId),
    getPresentielAssignmentsByRole(currentProjetId),
  ]);

  // Filtre appliqué avant même de récupérer photos/vidéos des entrées
  // écartées — pas la peine de les signer si elles ne s'affichent pas.
  let filteredEntries = entries;
  if (params.mode === "selftape" || params.mode === "presentiel") {
    filteredEntries = filteredEntries.filter((e) => e.mode === params.mode);
  }
  if (params.statut) filteredEntries = filteredEntries.filter((e) => e.statut === params.statut);
  const entriesFiltered = params.mode || params.statut;

  const figurantIds = filteredEntries.map((e) => e.figurant_id);
  const entryIds = filteredEntries.map((e) => e.id);
  const [photosByFigurant, videoPairsByEntry, entryPhotosByEntry] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    getCastingVideoUrlPairsByEntries(
      filteredEntries.map((e) => ({ id: e.id, video_storage_paths: e.video_storage_paths, video_labels: e.video_labels }))
    ),
    getCastingEntryPhotos(entryIds),
  ]);
  const portraitByFigurant = new Map(
    figurantIds.map((id) => [id, pickPortrait(photosByFigurant.get(id), currentProjetId)?.url ?? null])
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
            {roles.length} rôle{roles.length > 1 ? "s" : ""} · {filteredEntries.length} profil
            {filteredEntries.length > 1 ? "s" : ""}
            {entriesFiltered ? ` sur ${entries.length}` : ""}
          </p>
        </div>
      </div>
      {roles.length > 0 && (
        <details className="rounded-2xl border border-border bg-ink-raised/50 p-4">
          <summary className="cursor-pointer font-medium">Documents, exports et outils du casting</summary>
          <p className="mt-2 mb-3 text-sm text-text-muted">Trombinoscopes, casting présentiel, distribution et documents à partager.</p>
          <div className="flex flex-wrap gap-2">
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
        </details>
      )}

      {entries.length > 0 && <form className="flex flex-wrap items-center gap-2" method="get">
        <Select name="mode" defaultValue={params.mode ?? ""} className="w-44">
          <option value="">Mode (tous)</option>
          <option value="selftape">{CASTING_MODE_LABELS.selftape}</option>
          <option value="presentiel">{CASTING_MODE_LABELS.presentiel}</option>
        </Select>
        <Select name="statut" defaultValue={params.statut ?? ""} className="w-44">
          <option value="">Statut (tous)</option>
          {CASTING_STATUTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
        <button
          type="submit"
          className="rounded-full bg-ink-raised-2 px-4 py-2 text-sm font-medium hover:border hover:border-coral/60"
        >
          Filtrer
        </button>
        {entriesFiltered && (
          <Link href="/casting" className="text-sm font-medium text-text-muted hover:text-text">
            Réinitialiser
          </Link>
        )}
      </form>}

      {roles.length > 0 && <NewCastingRoleCard projetId={currentProjetId} />}

      {roles.map((role, i) => (
        <CastingRoleSection
          key={role.id}
          projetId={currentProjetId}
          projetNom={projet.nom}
          origin={origin}
          signature={signature}
          role={role}
          entries={entriesByRole.get(role.id) ?? []}
          portraitByFigurant={portraitByFigurant}
          videoUrlsByEntry={videoUrlsByEntry}
          entryPhotosByEntry={entryPhotosByEntry}
          allFigurants={allFigurants ?? []}
          templates={templates ?? []}
          presentielJournees={presentielJournees}
          presentielAssignments={presentielAssignments.get(role.id) ?? new Map()}
          position={i + 1}
        />
      ))}

      {roles.length === 0 && (
        <Card className="flex flex-col gap-4 border border-coral/25">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-coral">Première étape</p>
            <h2 className="mt-1 text-xl font-semibold">Crée ton premier rôle</h2>
            <p className="mt-2 text-sm text-text-muted">
              Un rôle correspond à un profil que tu recherches pour le projet. Une fois créé,
              tu pourras y ajouter des figurants depuis la base, puis gérer leurs vidéos et documents.
            </p>
          </div>
          <ol className="grid gap-2 text-sm sm:grid-cols-3">
            <li className="rounded-xl border border-coral/40 bg-ink p-3"><strong>1. Créer un rôle</strong><span className="mt-1 block text-text-muted">Nom et critères recherchés</span></li>
            <li className="rounded-xl border border-border bg-ink p-3"><strong>2. Ajouter des profils</strong><span className="mt-1 block text-text-muted">Recherche dans la base</span></li>
            <li className="rounded-xl border border-border bg-ink p-3"><strong>3. Examiner et choisir</strong><span className="mt-1 block text-text-muted">Vidéos, PDF et sélection</span></li>
          </ol>
          <NewCastingRoleCard projetId={currentProjetId} />
        </Card>
      )}

      {roles.length > 0 && <PartageCard
        projetId={currentProjetId}
        type="casting"
        label={`Partage réal — Casting « ${projet.nom} »`}
        description="Lien en lecture seule pour le réalisateur·ice, classé par rôle."
        token={partageToken}
        publicBaseUrl={`${origin}/partage/casting`}
        titre={partageTitre}
        titrePlaceholder={`Casting — ${projet.nom}`}
      >
        <CastingDocsVisibilityToggle
          projetId={currentProjetId}
          listeArtistique={docsVisibility.listeArtistique}
          fichesRoles={docsVisibility.fichesRoles}
          distribution={docsVisibility.distribution}
          fichesRolesMasquerContact={docsVisibility.fichesRolesMasquerContact}
        />
      </PartageCard>}
    </div>
  );
}
