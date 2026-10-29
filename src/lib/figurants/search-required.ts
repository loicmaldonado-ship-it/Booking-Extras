export const RECHERCHE_MIN = 3;

// La recherche est obligatoire pour chaque compte, quel que soit son rôle.
export function maySearchProfiles(recherche: string, parCriteres: boolean): boolean {
  return recherche.trim().length >= RECHERCHE_MIN || parCriteres;
}
