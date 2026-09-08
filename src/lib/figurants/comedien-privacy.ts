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
// `comedien_pool_id.is.null` reste visible : filet de sécurité si une
// fiche comédien·ne se retrouve sans pool plutôt que la masquer à tout le
// monde. Sans effet sur les figurant·es (est_comedien = false), toujours
// partagé·es.
export function comedienPoolClause(profile: CurrentProfile | null): string | null {
  if (!profile || profile.isOwner) return null;
  const poolId = comedienPoolIdFor(profile);
  return `est_comedien.eq.false,comedien_pool_id.is.null,comedien_pool_id.eq.${poolId}`;
}
