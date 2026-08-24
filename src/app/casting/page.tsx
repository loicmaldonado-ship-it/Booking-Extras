import { createAdminClient } from "@/lib/supabase/admin";
import { Card, Badge } from "@/components/ui/card";
import { ProjetPicker } from "@/components/bookings/projet-picker";
import { PartageCard } from "@/components/partage/partage-card";
import { getPartageToken } from "@/lib/partage/actions";
import { getSiteOrigin } from "@/lib/partage/data";
import { getCastingEntries, getCastingVideoUrl } from "@/lib/casting/data";
import { getPhotosByFigurantId, pickPortrait } from "@/lib/documents/data";
import { CastingEntryCard } from "@/components/casting/casting-entry-card";
import { AddToCastingPicker } from "@/components/casting/add-to-casting-picker";
import { getCurrentProjetId } from "@/lib/projet-context";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
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
  if (accessibleIds !== null && !accessibleIds.includes(currentProjetId)) {
    return <ProjetPicker projets={await accessibleProjets()} redirectTo="/casting" sectionLabel="Casting" />;
  }

  const { data: projet } = await supabase.from("projets").select("nom, confidentiel").eq("id", currentProjetId).single();
  if (!projet) {
    return <ProjetPicker projets={await accessibleProjets()} redirectTo="/casting" sectionLabel="Casting" />;
  }

  const [entries, partageToken, origin] = await Promise.all([
    getCastingEntries(currentProjetId),
    getPartageToken(currentProjetId, "casting"),
    getSiteOrigin(),
  ]);

  const figurantIds = entries.map((e) => e.figurant_id);
  const [photosByFigurant, videoUrls] = await Promise.all([
    getPhotosByFigurantId(figurantIds),
    Promise.all(entries.map((e) => getCastingVideoUrl(e.video_storage_path))),
  ]);
  const videoUrlByEntry = new Map(entries.map((e, i) => [e.id, videoUrls[i]]));

  // Profils déjà bookés ou candidats sur ce projet, pas encore dans le
  // casting — bassin pour "+ Ajouter au casting".
  type PoolRow = { figurant_id: string; figurants: { id: string; prenom: string; nom: string; email: string | null } | null };

  const entryFigurantIds = new Set(entries.map((e) => e.figurant_id));
  const [{ data: bookedFigurants }, { data: annonces }] = await Promise.all([
    supabase
      .from("bookings")
      .select("figurant_id, figurants!bookings_figurant_id_fkey(id, prenom, nom, email)")
      .eq("projet_id", currentProjetId)
      .returns<PoolRow[]>(),
    supabase.from("annonces").select("id").eq("projet_id", currentProjetId),
  ]);
  const annonceIds = (annonces ?? []).map((a) => a.id);
  const { data: candidatureFigurants } =
    annonceIds.length > 0
      ? await supabase
          .from("candidatures")
          .select("figurant_id, figurants(id, prenom, nom, email)")
          .in("annonce_id", annonceIds)
          .returns<PoolRow[]>()
      : { data: [] as PoolRow[] };

  const poolMap = new Map<string, { id: string; prenom: string; nom: string; email: string | null }>();
  for (const b of [...(bookedFigurants ?? []), ...(candidatureFigurants ?? [])]) {
    if (b.figurants && !entryFigurantIds.has(b.figurants.id)) poolMap.set(b.figurants.id, b.figurants);
  }
  const pool = Array.from(poolMap.values());

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
            {entries.length} profil{entries.length > 1 ? "s" : ""} au casting
          </p>
        </div>
      </div>

      <AddToCastingPicker projetId={currentProjetId} pool={pool} />

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Profils demandés</h2>
        {entries.length === 0 && (
          <p className="text-sm text-text-muted">Aucun profil demandé pour l&apos;instant sur ce projet.</p>
        )}
        <div className="flex flex-wrap gap-3">
          {entries.map((entry) => (
            <CastingEntryCard
              key={entry.id}
              entry={entry}
              portraitUrl={pickPortrait(photosByFigurant.get(entry.figurant_id), currentProjetId)?.url ?? null}
              videoUrl={videoUrlByEntry.get(entry.id) ?? null}
            />
          ))}
        </div>
      </Card>

      <PartageCard
        projetId={currentProjetId}
        type="casting"
        label={`Partage réal — Casting « ${projet.nom} »`}
        description="Lien en lecture seule pour le réalisateur·ice : rôles avec vidéo, figurants en trombi seul."
        token={partageToken}
        publicBaseUrl={`${origin}/partage/casting`}
      />
    </div>
  );
}
