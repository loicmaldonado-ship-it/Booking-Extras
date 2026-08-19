import type { Cachet } from "@/lib/candidatures/types";
import type { Convention } from "@/lib/projets/types";

export type BaremeCachet = {
  id: string;
  convention: Convention;
  cachet: Cachet;
  montant_brut: number;
  date_effet: string;
  notes: string | null;
};

export type MajorationValeurType =
  | "pourcentage"
  | "montant_fixe"
  | "cachet_double"
  | "pourcentage_remuneration"
  | "pourcentage_salaire_jour";

export type BaremeMajoration = {
  id: string;
  convention: Convention;
  type: string;
  label: string;
  valeur_type: MajorationValeurType;
  valeur: number | null;
  cinema_uniquement: boolean;
  notes: string | null;
  date_effet: string;
};

export function formatMajorationValeur(m: Pick<BaremeMajoration, "valeur_type" | "valeur">) {
  switch (m.valeur_type) {
    case "pourcentage":
      return `+${m.valeur}%`;
    case "pourcentage_remuneration":
      return `${m.valeur}% de la rémunération`;
    case "pourcentage_salaire_jour":
      return `${m.valeur}% du salaire journalier`;
    case "cachet_double":
      return "Cachet doublé";
    case "montant_fixe":
      return m.valeur != null ? `+${m.valeur} €` : "—";
    default:
      return "—";
  }
}
