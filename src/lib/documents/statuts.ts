import type { BookingStatut } from "@/lib/bookings/types";

// Filtre par statut des trombis et fiches mensuration d'une journée : par
// défaut les confirmé·es (document de tournage), mais on peut aussi sortir
// les proposé·es (à montrer à la réalisation), les PER, ou tout le monde.
export type DocStatut = "confirmes" | "proposes" | "per" | "tous";

export const DOC_STATUTS: { key: DocStatut; label: string; statuts: BookingStatut[] }[] = [
  { key: "confirmes", label: "Confirmé·es", statuts: ["confirmé"] },
  { key: "proposes", label: "Proposé·es MES", statuts: ["proposé"] },
  { key: "per", label: "PER", statuts: ["envoyé"] },
  {
    key: "tous",
    label: "Tout le monde",
    statuts: [
      "proposé",
      "envoyé",
      "attente_reponse_booking",
      "a_relancer",
      "doit_rappeler",
      "a_rappeler",
      "attente_validation",
      "valide",
      "confirmé",
      "a_annuler",
    ],
  },
];

// Une sélection faite dans la journée (booking_ids) vise des personnes
// précises : sans statut choisi, on les garde toutes.
export function parseDocStatut(v: string | undefined, avecSelection: boolean): (typeof DOC_STATUTS)[number] {
  return DOC_STATUTS.find((s) => s.key === v) ?? DOC_STATUTS.find((s) => s.key === (avecSelection ? "tous" : "confirmes"))!;
}
