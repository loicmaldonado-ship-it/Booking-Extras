import type { Figurant } from "@/lib/figurants/types";

// "Toute mensuration" (demande cheffe) — chaque champ numérique du profil
// mesurable devient un filtre min/max, en plus du code postal (utile pour
// le covoiturage) et des tailles vêtements (texte libre, pas de valeurs
// fixes sur la fiche).
export const MENSURATION_RANGE_FIELDS = [
  { key: "taille", column: "taille_cm", label: "Taille (cm)" },
  { key: "poids", column: "poids_kg", label: "Poids (kg)" },
  { key: "pointure", column: "pointure", label: "Pointure" },
  { key: "poitrine", column: "tour_poitrine_cm", label: "Tour poitrine (cm)" },
  { key: "tour_taille", column: "tour_taille_cm", label: "Tour de taille (cm)" },
  { key: "hanches", column: "tour_hanches_cm", label: "Tour hanches (cm)" },
  { key: "tete", column: "tour_tete_cm", label: "Tour de tête (cm)" },
  { key: "cou", column: "tour_cou_cm", label: "Tour de cou (cm)" },
  { key: "jambes_ext", column: "jambes_ext_cm", label: "Jambes ext. (cm)" },
  { key: "jambes_int", column: "jambes_int_cm", label: "Jambes int. (cm)" },
  { key: "carrure", column: "carrure_cm", label: "Carrure (cm)" },
] as const satisfies { key: string; column: keyof Figurant; label: string }[];

export const MENSURATION_TEXT_FIELDS: { key: "veste" | "pantalon" | "gant"; label: string }[] = [
  { key: "veste", label: "Veste" },
  { key: "pantalon", label: "Pantalon" },
  { key: "gant", label: "Gant" },
];

export type MensurationFilters = {
  code_postal?: string;
  veste?: string;
  pantalon?: string;
  gant?: string;
} & Record<`${string}_min` | `${string}_max`, string | undefined>;

export function hasActiveMensurationFilters(params: MensurationFilters): boolean {
  if (params.code_postal || params.veste || params.pantalon || params.gant) return true;
  return MENSURATION_RANGE_FIELDS.some((f) => params[`${f.key}_min`] || params[`${f.key}_max`]);
}

type MensurationSubject = Partial<Pick<Figurant, (typeof MENSURATION_RANGE_FIELDS)[number]["column"] | "code_postal" | "veste" | "pantalon" | "gant">>;

// Filtrage en mémoire (candidatures — les autres filtres de cette page
// s'appliquent déjà en JS sur la liste chargée, pas via le query builder
// Supabase) : un champ non renseigné sur la fiche exclut le profil dès
// qu'un filtre est actif sur ce champ, plutôt que de l'inclure par défaut.
export function figurantMatchesMensurationFilters(
  f: MensurationSubject | null | undefined,
  params: MensurationFilters
): boolean {
  if (params.code_postal && !(f?.code_postal ?? "").startsWith(params.code_postal)) return false;
  for (const { key } of MENSURATION_TEXT_FIELDS) {
    const wanted = params[key];
    if (wanted && !(f?.[key] ?? "").toLowerCase().includes(wanted.toLowerCase())) return false;
  }
  for (const { key, column } of MENSURATION_RANGE_FIELDS) {
    const min = params[`${key}_min`];
    const max = params[`${key}_max`];
    if (!min && !max) continue;
    const value = f?.[column];
    if (typeof value !== "number") return false;
    if (min && value < Number(min)) return false;
    if (max && value > Number(max)) return false;
  }
  return true;
}
