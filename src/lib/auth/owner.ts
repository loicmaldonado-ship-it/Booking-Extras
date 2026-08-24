// Export Excel réservé au compte propriétaire — même une fois le
// multi-chef·fes en place, les autres chef·fes et assistant·es n'y auront
// pas accès. Rattaché à l'email plutôt qu'au rôle "chef" pour cette
// raison : "chef" désignera bientôt plusieurs comptes.
export const OWNER_EMAIL = "loicmaldonado@gmail.com";

export function isOwner(profile: { email: string | null } | null): boolean {
  return profile?.email === OWNER_EMAIL;
}
