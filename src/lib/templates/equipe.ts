import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, getSupportChefId, type CurrentProfile } from "@/lib/auth/session";
import type { MessageTemplate } from "./types";

// Équipes dont ce compte voit les modèles de messages : la sienne pour une
// cheffe (comedien_pool_id, sinon son id — même clé que les fiches
// comédien·nes), celles des cheffes qui l'ont invité·e pour un·e
// assistant·e. `ecriture` = équipe où ranger un nouveau modèle.
export async function equipesModeles(
  profile: CurrentProfile | null
): Promise<{ lecture: string[]; ecriture: string | null }> {
  if (!profile) return { lecture: [], ecriture: null };
  const admin = createAdminClient();

  const supportChefId = await getSupportChefId(profile);
  if (supportChefId) {
    const { data } = await admin.from("profiles").select("id, comedien_pool_id").eq("id", supportChefId).maybeSingle();
    const cle = data ? (data.comedien_pool_id ?? data.id) : null;
    return { lecture: cle ? [cle] : [], ecriture: cle };
  }

  if (profile.role === "chef") {
    const cle = profile.comedienPoolId ?? profile.id;
    return { lecture: [cle], ecriture: cle };
  }

  const { data } = await admin
    .from("projet_membres")
    .select("created_at, projets(profiles!projets_owner_id_fkey(id, comedien_pool_id))")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: true })
    .returns<{ projets: { profiles: { id: string; comedien_pool_id: string | null } | null } | null }[]>();
  const cles = Array.from(
    new Set(
      (data ?? [])
        .map((m) => m.projets?.profiles)
        .filter((p): p is { id: string; comedien_pool_id: string | null } => !!p)
        .map((p) => p.comedien_pool_id ?? p.id)
    )
  );
  return { lecture: cles, ecriture: cles[0] ?? null };
}

// Modèles visibles par le compte connecté, triés par nom.
export async function getModelesEquipe(): Promise<MessageTemplate[]> {
  const { lecture } = await equipesModeles(await getCurrentProfile());
  if (lecture.length === 0) return [];
  const { data } = await createAdminClient()
    .from("message_templates")
    .select("*")
    .in("equipe_id", lecture)
    .order("nom")
    .returns<MessageTemplate[]>();
  return data ?? [];
}
