export type NotificationType = "candidature" | "reponse" | "compte_cree" | "casting";

export type AppNotification = {
  id: string;
  type: NotificationType;
  titre: string;
  figurant_id: string | null;
  lien: string | null;
  lu_at: string | null;
  created_at: string;
};

export type CandidatureATrier = {
  annonce_id: string;
  annonce_titre: string;
  count: number;
};
