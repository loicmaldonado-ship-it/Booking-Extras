export type CastingRole = {
  id: string;
  projet_id: string;
  nom: string;
  date_tournage: string | null;
  nb_videos: number;
  photo_labels: string[];
  demande_bande_demo: boolean;
  message_corps: string | null;
  created_at: string;
};

export type CastingEntry = {
  id: string;
  projet_id: string;
  role_id: string;
  figurant_id: string;
  booking_id: string | null;
  candidature_id: string | null;
  request_token: string;
  video_storage_paths: string[];
  requested_at: string;
  submitted_at: string | null;
  figurants: { prenom: string; nom: string; email: string | null } | null;
};
