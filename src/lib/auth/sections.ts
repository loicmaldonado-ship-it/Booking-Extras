// Sections restreignables pour un·e assistant·e (checkboxes dans la console
// Équipe). "Tableau de bord" n'en fait pas partie — toujours accessible.
export type SectionKey =
  | "/figurants"
  | "/projets"
  | "/annonces"
  | "/candidatures"
  | "/bookings"
  | "/essayages"
  | "/casting"
  | "/partage"
  | "/modeles"
  | "/bareme"
  | "/rgpd";

export const APP_SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "/figurants", label: "Base Profils" },
  { key: "/projets", label: "Projets" },
  { key: "/annonces", label: "Annonces" },
  { key: "/candidatures", label: "Candidatures" },
  { key: "/bookings", label: "Bookings" },
  { key: "/essayages", label: "Essayages" },
  { key: "/casting", label: "Casting" },
  { key: "/partage", label: "Partage" },
  { key: "/modeles", label: "Modèles" },
  { key: "/bareme", label: "Barème" },
  { key: "/rgpd", label: "RGPD" },
];

// sectionsAutorisees === null → accès complet (comportement historique,
// tant que la cheffe n'a rien coché explicitement pour cet assistant·e).
// Les comptes "chef" ne sont jamais restreints.
export function hasSectionAccess(
  profile: { role: "chef" | "assistant"; sectionsAutorisees?: string[] | null } | null | undefined,
  section: SectionKey
): boolean {
  if (!profile) return false;
  if (profile.role === "chef") return true;
  if (profile.sectionsAutorisees == null) return true;
  return profile.sectionsAutorisees.includes(section);
}
