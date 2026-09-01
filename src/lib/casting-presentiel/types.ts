import type { BookingStatut } from "@/lib/bookings/types";
import type { Genre, PhotoType } from "@/lib/figurants/types";

export type PresentielEntry = {
  id: string;
  statut: BookingStatut;
  notes: string | null;
  creneau_id: string | null;
  figurant_id: string;
  role_id: string | null;
  figurants: { prenom: string; nom: string; telephone: string | null; email: string | null; genre?: Genre | null } | null;
  casting_roles: { nom: string } | null;
  portraitUrl: string | null;
  photos?: { url: string | null; type: PhotoType }[];
};
