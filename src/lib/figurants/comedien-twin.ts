import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { comedienPoolIdFor } from "@/lib/figurants/comedien-privacy";
import type { CurrentProfile } from "@/lib/auth/session";

type FigurantSource = {
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  genre: string | null;
};

// Retrouve (ou crée) la fiche comédien·ne de cette personne dans le pool de
// qui envoie — pour un rôle "cachet rôle", le profil rejoint la base
// comédien·ne perso de la chef·fe (ou du groupe partagé) au lieu de rester
// rattaché à sa fiche figurant·e. La fiche figurant·e d'origine n'est
// jamais modifiée (voir la fiche "double" introduite pour Marwan) — juste
// gardée telle quelle, self-service pour la personne.
export async function findOrCreateComedienTwin(
  source: FigurantSource,
  profile: CurrentProfile | null
): Promise<string | null> {
  const supabase = createAdminClient();
  const poolId = comedienPoolIdFor(profile);

  if (source.email) {
    let query = supabase.from("figurants").select("id").eq("est_comedien", true).ilike("email", source.email);
    query = poolId ? query.eq("comedien_pool_id", poolId) : query.is("comedien_pool_id", null);
    const { data: existing } = await query.maybeSingle();
    if (existing) return existing.id;
  } else if (source.telephone) {
    const telephoneNormalise = source.telephone.replace(/\s+/g, "");
    let query = supabase
      .from("figurants")
      .select("id, telephone")
      .eq("est_comedien", true)
      .ilike("nom", source.nom);
    query = poolId ? query.eq("comedien_pool_id", poolId) : query.is("comedien_pool_id", null);
    const { data: candidats } = await query;
    const doublon = (candidats ?? []).find((f) => f.telephone?.replace(/\s+/g, "") === telephoneNormalise);
    if (doublon) return doublon.id;
  }

  const { data: created, error } = await supabase
    .from("figurants")
    .insert({
      prenom: source.prenom,
      nom: source.nom,
      email: source.email,
      telephone: source.telephone,
      genre: source.genre,
      est_comedien: true,
      comedien_pool_id: poolId,
      confirme: true,
    })
    .select("id")
    .single();
  if (error || !created) return null;
  return created.id;
}
