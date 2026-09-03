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
    supabase.from("figurants").select("id, prenom, nom").order("nom"),
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
        <div className="flex flex-wrap justify-end gap-2">
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

      <form className="flex flex-wrap items-center gap-2" method="get">
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
      </form>

      <NewCastingRoleCard projetId={currentProjetId} />

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
        <Card>
          <p className="text-sm text-text-muted">
            Aucun rôle pour l&apos;instant — crée-en un ci-dessus, ou envoie une sélection depuis Base Profils,
            Bookings ou Candidatures (bouton « Envoyer au casting »).
          </p>
        </Card>
      )}

      <PartageCard
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
        />
      </PartageCard>
    </div>
  );
}
