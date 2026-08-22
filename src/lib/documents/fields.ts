export type DocumentField = "fonction" | "telephone" | "email" | "age" | "ville" | "sexe";

export const DOCUMENT_FIELDS: { key: DocumentField; label: string }[] = [
  { key: "fonction", label: "Fonction" },
  { key: "telephone", label: "Téléphone" },
  { key: "email", label: "Email" },
  { key: "age", label: "Âge" },
  { key: "ville", label: "Ville" },
  { key: "sexe", label: "Genre" },
];

export function parseFields(raw: string | string[] | undefined): Set<DocumentField> {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const valid = new Set(DOCUMENT_FIELDS.map((f) => f.key));
  return new Set(list.filter((f): f is DocumentField => valid.has(f as DocumentField)));
}

// null = pas de sélection, on garde tout. Set (même vide) = filtrer sur ces ids.
export function parseIds(raw: string | undefined): Set<string> | null {
  if (!raw) return null;
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return ids.length > 0 ? new Set(ids) : null;
}

export function formatHeureConvocation(heure: string) {
  const [h, m] = heure.slice(0, 5).split(":");
  return `${h}H${m}`;
}

export function computeAge(dateNaissance: string | null): number | null {
  if (!dateNaissance) return null;
  const birth = new Date(dateNaissance + "T00:00:00");
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}
