export type AnnonceStatut = "ouverte" | "fermée";

export type Annonce = {
  id: string;
  projet_id: string;
  titre: string;
  date_recherchee: string | null;
  lieu: string | null;
  statut: AnnonceStatut;
  description: string | null;
  public_token: string;
  ouverte_mineurs: boolean;
  limite_candidatures: number | null;
  created_at: string;
  updated_at: string;
};

export type AnnonceAvecProjet = Annonce & {
  projets: { nom: string; confidentiel: boolean; nom_code: string | null; signature: string | null } | null;
};
