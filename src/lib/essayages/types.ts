export type EssayageStatut = "proposé" | "confirmé" | "fait";

export type Essayage = {
  id: string;
  numero: number;
  figurant_id: string;
  projet_id: string;
  date: string | null;
  heure: string | null;
  lieu: string | null;
  statut: EssayageStatut;
  notes: string | null;
  reponse_recue: boolean;
  created_at: string;
  updated_at: string;
};

export const ESSAYAGE_STATUTS: EssayageStatut[] = ["proposé", "confirmé", "fait"];
