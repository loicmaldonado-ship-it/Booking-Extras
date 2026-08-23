export type ProjetIndemnite = {
  id: string;
  projet_id: string;
  label: string;
  montant: number;
  created_at: string;
};

export type BookingIndemnite = {
  id: string;
  booking_id: string;
  projet_indemnite_id: string;
  created_at: string;
};
