// "Compte propriétaire" = accès total à tout, toutes les chef·fes
// confondues (voir /admin). Stocké en base (profiles.is_owner) plutôt que
// sur un email en dur, pour pouvoir en avoir plusieurs — Loïc et Mathieu
// à ce jour.
export function isOwner(profile: { isOwner?: boolean } | null | undefined): boolean {
  return !!profile?.isOwner;
}
