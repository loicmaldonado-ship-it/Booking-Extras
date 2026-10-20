import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AvisReel, Avis } from "@/lib/casting/avis";

// Côté équipe : ce que les réal ont répondu sur le lien casting du projet,
// par profil (avis de chacun·e, nombre de commentaires).
export async function getRetourReel(projetId: string): Promise<{
  avisParEntry: Record<string, AvisReel[]>;
  commentairesParEntry: Record<string, number>;
}> {
  const supabase = createAdminClient();
  // Tous les liens casting du projet (tout le casting + un par catégorie) :
  // un profil garde ses avis quel que soit le lien qui les a recueillis.
  const { data: liens } = await supabase.from("partage_liens").select("id").eq("projet_id", projetId).eq("type", "casting");
  const lienIds = (liens ?? []).map((l) => l.id);
  if (lienIds.length === 0) return { avisParEntry: {}, commentairesParEntry: {} };
  const [{ data: avis }, { data: commentaires }] = await Promise.all([
    supabase
      .from("casting_avis")
      .select("entry_id, visiteur_nom, visiteur_role, avis")
      .in("lien_id", lienIds)
      .order("updated_at")
      .returns<{ entry_id: string; visiteur_nom: string; visiteur_role: string; avis: Avis }[]>(),
    supabase
      .from("partage_commentaires")
      .select("casting_entry_id")
      .eq("lien_type", "casting")
      .in("lien_id", lienIds)
      .not("casting_entry_id", "is", null)
      .returns<{ casting_entry_id: string }[]>(),
  ]);
  const avisParEntry: Record<string, AvisReel[]> = {};
  for (const a of avis ?? []) (avisParEntry[a.entry_id] ??= []).push({ nom: a.visiteur_nom, role: a.visiteur_role, avis: a.avis });
  const commentairesParEntry: Record<string, number> = {};
  for (const c of commentaires ?? []) commentairesParEntry[c.casting_entry_id] = (commentairesParEntry[c.casting_entry_id] ?? 0) + 1;
  return { avisParEntry, commentairesParEntry };
}
