export type FigurantMessageCategorie = "booking" | "convocation" | "covoiturage" | "essayage" | "libre";

export const FIGURANT_MESSAGE_CATEGORIES: { value: FigurantMessageCategorie; label: string }[] = [
  { value: "booking", label: "Booking" },
  { value: "convocation", label: "Convocations" },
  { value: "covoiturage", label: "Covoiturage" },
  { value: "essayage", label: "Essayage" },
  { value: "libre", label: "Libre" },
];

export type FigurantMessage = {
  id: string;
  figurant_id: string;
  booking_id?: string | null;
  sender: "staff" | "figurant";
  corps: string;
  sujet?: string | null;
  bien_recu: boolean;
  repondu?: boolean;
  categorie: FigurantMessageCategorie;
  created_at: string;
};
