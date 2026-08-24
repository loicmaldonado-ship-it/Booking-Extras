export type CastingEntry = {
  id: string;
  projet_id: string;
  figurant_id: string;
  booking_id: string | null;
  candidature_id: string | null;
  silhouette: boolean;
  role_label: string | null;
  request_token: string;
  video_storage_path: string | null;
  requested_at: string;
  submitted_at: string | null;
  figurants: { prenom: string; nom: string; email: string | null } | null;
};
