export type MessageTemplate = {
  id: string;
  nom: string;
  sujet: string;
  corps: string;
  created_at: string;
  updated_at: string;
  // null = modèle prêt à l'emploi, commun à toutes les équipes.
  equipe_id: string | null;
};

// Libellé dans les sélecteurs : ⭐ devant les modèles prêts à l'emploi.
export function nomModele(t: MessageTemplate) {
  return t.equipe_id ? t.nom : `⭐ ${t.nom}`;
}
