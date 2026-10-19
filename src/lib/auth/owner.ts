// "Compte propriétaire" = accès total à tout, toutes les chef·fes
// confondues (voir /admin). Stocké en base (profiles.is_owner) plutôt que
// sur un email en dur, pour pouvoir en avoir plusieurs — Loïc et Mathieu
// à ce jour.
// Accès complet (propriétaires + profiles.acces_complet) : Base Profils en
// libre service et révocation de l'accès d'un compte candidat·e.
export function aAccesComplet(profile: { isOwner?: boolean; accesComplet?: boolean } | null | undefined): boolean {
  return !!profile?.isOwner || !!profile?.accesComplet;
}

export function isOwner(profile: { isOwner?: boolean } | null | undefined): boolean {
  return !!profile?.isOwner;
}
