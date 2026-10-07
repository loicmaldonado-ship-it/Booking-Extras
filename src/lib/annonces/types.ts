import type { Cachet } from "@/lib/candidatures/types";

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
  bande_demo_obligatoire: boolean;
  limite_candidatures: number | null;
  types_cachet: Cachet[];
  // Style de l'affiche, null = style d'origine (voir affiche.ts)
  affiche_couleur: string | null;
  affiche_police: string | null;
  affiche_couleur_titre: string | null;
  affiche_police_corps: string | null;
  affiche_couleur_corps: string | null;
  affiche_taille_corps: string | null;
  created_at: string;
  updated_at: string;
};

export type AnnonceAvecProjet = Annonce & {
  projets: {
    nom: string;
    confidentiel: boolean;
    nom_code: string | null;
    signature: string | null;
    annonce_photo_storage_path: string | null;
  } | null;
};
