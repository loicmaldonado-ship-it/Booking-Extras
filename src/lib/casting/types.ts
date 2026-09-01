import type { BookingStatut } from "@/lib/bookings/types";
import type { Genre } from "@/lib/figurants/types";

export type CategorieCachet = "role" | "silhouette" | "doublure";

export const CATEGORIE_CACHET_LABELS: Record<CategorieCachet, string> = {
  role: "Rôle",
  silhouette: "Silhouette",
  doublure: "Doublure",
};

export type CastingRole = {
  id: string;
  projet_id: string;
  nom: string;
  date_tournage: string | null;
  categorie_cachet: CategorieCachet;
  nb_videos: number;
  photo_labels: string[];
  demande_bande_demo: boolean;
  message_corps: string | null;
  visible_partage: boolean;
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
  statut: BookingStatut;
  figurants: {
    prenom: string;
    nom: string;
    email: string | null;
    telephone: string | null;
    genre: Genre | null;
    date_naissance: string | null;
    a_vehicule: boolean | null;
    vehicule_velo: boolean;
    vehicule_moto: boolean;
    vehicule_scooter: boolean;
    compte_myrole: boolean;
    est_comedien: boolean;
    agent_nom: string | null;
    agent_email: string | null;
    agent_telephone: string | null;
  } | null;
};
