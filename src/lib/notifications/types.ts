export type NotificationType = "candidature" | "reponse" | "compte_cree" | "casting";

export type AppNotification = {
  id: string;
  type: NotificationType;
  titre: string;
  figurant_id: string | null;
  projet_id: string | null;
  annonce_id: string | null;
  lien: string | null;
  lu_at: string | null;
  created_at: string;
};

export type CandidatureATrier = {
  annonce_id: string;
  annonce_titre: string;
  count: number;
};

// Plusieurs événements du même type sur la même annonce (ou le même projet)
// affichés en une seule ligne dans la cloche ; les non lus et les lus ne
// sont jamais mélangés dans un même groupe.
export type NotificationGroup = {
  key: string;
  type: NotificationType;
  titre: string;
  lien: string | null;
  nonLu: boolean;
  latestAt: string;
  items: AppNotification[];
};
