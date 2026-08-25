import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/components/ui/card";
import { ProjetPicker } from "@/components/bookings/projet-picker";
import { PartageCard } from "@/components/partage/partage-card";
import { getPartageToken, getPartageTitre } from "@/lib/partage/actions";
import { getSiteOrigin } from "@/lib/partage/data";
import { getCastingRoles, getCastingEntries, getCastingVideoUrls } from "@/lib/casting/data";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { CastingRoleSection } from "@/components/casting/casting-role-section";
import { NewCastingRoleCard } from "@/components/casting/new-casting-role-card";
import { getCurrentProjetId } from "@/lib/projet-context";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import type { MessageTemplate } from "@/lib/templates/types";
import { Video } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CastingPage({
  searchParams,
}: {
  searchParams: Promise<{ switch?: string }>;
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

  const [roles, entries, partageToken, partageTitre, origin, { data: allFigurants }, { data: templates }] =
    await Promise.all([
      getCastingRoles(currentProjetId),
      getCastingEntries(currentProjetId),
      getPartageToken(currentProjetId, "casting"),
      getPartageTitre(currentProjetId, "casting"),
      getSiteOrigin(),
      supabase.from("figurants").select("id, prenom, nom").order("nom"),
      supabase.from("message_templates").select("*").order("nom").returns<MessageTemplate[]>(),
    ]);

  const figurantIds = entries.map((e) => e.figurant_id);
  const [photosByFigurant, ...videoUrlsList] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    ...entries.map((e) => getCastingVideoUrls(e.video_storage_paths)),
  ]);
  const portraitByFigurant = new Map(
    figurantIds.map((id) => [id, pickPortrait(photosByFigurant.get(id), currentProjetId)?.url ?? null])
  );
  const videoUrlsByEntry = new Map(entries.map((e, i) => [e.id, videoUrlsList[i]]));

  const entriesByRole = new Map<string, typeof entries>();
  for (const e of entries) {
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
            {roles.length} rôle{roles.length > 1 ? "s" : ""} · {entries.length} profil{entries.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <NewCastingRoleCard projetId={currentProjetId} />

      {roles.map((role) => (
        <CastingRoleSection
          key={role.id}
          projetId={currentProjetId}
          projetNom={projet.nom}
          role={role}
          entries={entriesByRole.get(role.id) ?? []}
          portraitByFigurant={portraitByFigurant}
          videoUrlsByEntry={videoUrlsByEntry}
          allFigurants={allFigurants ?? []}
          templates={templates ?? []}
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
      />
    </div>
  );
}
