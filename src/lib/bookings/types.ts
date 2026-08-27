import type { Cachet } from "@/lib/candidatures/types";

// Statut unifié : une seule progression, lisible d'un coup d'œil par toute
// l'équipe. Proposé -> PER (pas encore de réponse) -> À relancer / Doit
// rappeler -> Attente validation / Validé (étape casting, si utilisée) ->
// CONFIRMÉ. Indisponible / Annulé possibles à tout moment.
export type BookingStatut =
  | "proposé"
  | "envoyé"
  | "a_relancer"
  | "doit_rappeler"
  | "attente_validation"
  | "valide"
  | "confirmé"
  | "indisponible"
  | "annulé";

export const STATUTS: {
  value: BookingStatut;
  label: string;
  tone: "default" | "coral" | "turquoise" | "yellow" | "danger";
}[] = [
  { value: "proposé", label: "Proposé", tone: "yellow" },
  { value: "envoyé", label: "PER (pas encore de réponse)", tone: "default" },
  { value: "a_relancer", label: "À relancer", tone: "yellow" },
  { value: "doit_rappeler", label: "Doit rappeler", tone: "yellow" },
  { value: "attente_validation", label: "Attente validation", tone: "coral" },
  { value: "valide", label: "Validé", tone: "turquoise" },
  { value: "confirmé", label: "CONFIRMÉ", tone: "turquoise" },
  { value: "indisponible", label: "Indisponible", tone: "danger" },
  { value: "annulé", label: "Annulé", tone: "default" },
];

export function statutLabel(v: BookingStatut) {
  return STATUTS.find((s) => s.value === v)?.label ?? v;
}

export function statutTone(v: BookingStatut) {
  return STATUTS.find((s) => s.value === v)?.tone ?? "default";
}

// "ppm" = par ses propres moyens (indemnité transport individuelle, pas
// partagée comme conducteur/passager) ; "transport_commun" = aucune
// indemnité, juste une catégorisation pour le doc/organisation.
export type CovoiturageRole = "conducteur" | "passager" | "ppm" | "transport_commun";

export const COVOITURAGE_ROLES: { value: CovoiturageRole; label: string }[] = [
  { value: "conducteur", label: "Conducteur·rice" },
  { value: "passager", label: "Passager·ère" },
  { value: "ppm", label: "PPM (par ses propres moyens)" },
  { value: "transport_commun", label: "Transport en commun" },
];

export function covoiturageRoleLabel(v: CovoiturageRole) {
  return COVOITURAGE_ROLES.find((r) => r.value === v)?.label ?? v;
}

export type Booking = {
  id: string;
  figurant_id: string;
  projet_id: string;
  candidature_id: string | null;
  date: string;
  heure_convocation: string | null;
  // fonction = ce que la personne joue dans la scène (passant, boulangère...)
  fonction: string | null;
  // cachet = la catégorie de paie/contrat, distincte de la fonction
  cachet: Cachet | null;
  statut: BookingStatut;
  lien_myrole_envoye: boolean;
  convocation_envoyee: boolean;
  notes: string | null;
  covoiturage_role: CovoiturageRole | null;
  covoiturage_lieu_depart: string | null;
  covoiturage_places_disponibles: number | null;
  covoiturage_conducteur_id: string | null;
  created_at: string;
  updated_at: string;
};
