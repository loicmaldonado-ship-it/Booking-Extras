// Choix des menus « Âge » et « Trier » de Candidatures (partagés entre la
// page serveur et la barre de filtres).
export const AGES = [
  { value: "18-30", label: "18–30 ans", min: "18", max: "30" },
  { value: "30-50", label: "30–50 ans", min: "30", max: "50" },
  { value: "50-", label: "50 ans et +", min: "50", max: "" },
  { value: "-17", label: "Moins de 18 ans", min: "", max: "17" },
] as const;

export const ORDRES = [
  { key: "recentes", label: "arrivée (récentes)" },
  { key: "anciennes", label: "arrivée (anciennes)" },
  { key: "nom", label: "nom" },
  { key: "age_asc", label: "plus jeunes" },
  { key: "age_desc", label: "plus âgé·es" },
  { key: "habitues", label: "habitué·es d'abord" },
] as const;
export type Ordre = (typeof ORDRES)[number]["key"];
