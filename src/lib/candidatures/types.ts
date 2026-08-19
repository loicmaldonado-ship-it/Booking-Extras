export type CandidatureStatut = "en_attente" | "retenu" | "refuse";
export type Cachet =
  | "Figurant"
  | "Silhouette"
  | "Silhouette parlante"
  | "Doublure simple"
  | "Doublure polyvalente"
  | "Rôle";

export const CANDIDATURE_STATUTS: { value: CandidatureStatut; label: string }[] = [
  { value: "en_attente", label: "En attente" },
  { value: "retenu", label: "Retenu" },
  { value: "refuse", label: "Refusé" },
];

export const CACHETS: Cachet[] = [
  "Figurant",
  "Silhouette",
  "Silhouette parlante",
  "Doublure simple",
  "Doublure polyvalente",
  "Rôle",
];

export type Candidature = {
  id: string;
  figurant_id: string;
  annonce_id: string;
  statut: CandidatureStatut;
  // fonction = ce que la personne joue dans la scène (passant, boulangère...)
  fonction_assignee: string | null;
  // cachet = la catégorie de paie/contrat (silhouette ou rôle), distincte de la fonction
  cachet_assigne: Cachet | null;
  message: string | null;
  created_at: string;
  updated_at: string;
};
