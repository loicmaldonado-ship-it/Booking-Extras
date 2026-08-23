export type FigurantMessageCategorie =
  | "booking"
  | "convocation"
  | "covoiturage"
  | "essayage"
  | "libre"
  | "espace_perso";

export const FIGURANT_MESSAGE_CATEGORIES: { value: FigurantMessageCategorie; label: string }[] = [
  { value: "booking", label: "Booking" },
  { value: "convocation", label: "Convocations" },
  { value: "covoiturage", label: "Covoiturage" },
  { value: "essayage", label: "Essayage" },
  { value: "libre", label: "Libre" },
  { value: "espace_perso", label: "Espace perso" },
];

export type FigurantMessage = {
  id: string;
  figurant_id: string;
  booking_id?: string | null;
  projet_id?: string | null;
  sender: "staff" | "figurant";
  corps: string;
  sujet?: string | null;
  bien_recu: boolean;
  repondu?: boolean;
  categorie: FigurantMessageCategorie;
  created_at: string;
};
