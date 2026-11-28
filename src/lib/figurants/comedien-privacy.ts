import type { CurrentProfile } from "@/lib/auth/session";

// Clé de partage des fiches comédien·nes pour ce profil — son propre id
// sert de pool personnel tant qu'aucun comedienPoolId explicite n'est posé
// (voir la migration comedien_pool_isolation).
export function comedienPoolIdFor(profile: Pick<CurrentProfile, "id" | "comedienPoolId"> | null): string | null {
  if (!profile) return null;
  return profile.comedienPoolId ?? profile.id;
}

// Clause .or() à ajouter à une requête `figurants` qui liste des profils —
// sans elle, les comédien·nes gérées par une autre chef·fe (hors du même
// pool) apparaîtraient dans les listes/pickers. Retourne null pour le
// compte propriétaire (voit tout) ou sans profil — rien à filtrer.
// Une fiche comédienne sans pool est réservée au propriétaire, qui peut
// corriger son rattachement. Les profils ordinaires restent partagés après activation.
export function comedienPoolClause(profile: CurrentProfile | null): string | null {
  if (!profile || profile.isOwner) return null;
  const poolId = comedienPoolIdFor(profile);
  return `est_comedien.eq.false,comedien_pool_id.eq.${poolId}`;
}
