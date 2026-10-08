export type ReferenceType = "film" | "serie" | "court" | "pub" | "clip" | "autre";

export const REFERENCE_TYPES: { value: ReferenceType; label: string }[] = [
  { value: "film", label: "Long métrage" },
  { value: "serie", label: "Série" },
  { value: "court", label: "Court métrage" },
  { value: "pub", label: "Publicité" },
  { value: "clip", label: "Clip" },
  { value: "autre", label: "Autre" },
];

export function referenceTypeLabel(v: string): string {
  return REFERENCE_TYPES.find((t) => t.value === v)?.label ?? v;
}

export type Reference = {
  id: string;
  titre: string;
  type: ReferenceType;
  annee: number | null;
  realisation: string | null;
  affiche_storage_path: string | null;
  ordre: number;
  visible: boolean;
  afficheUrl: string | null;
};
