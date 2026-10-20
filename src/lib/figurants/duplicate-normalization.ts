/**
 * Normalisation prudente pour SIGNALER des doublons possibles, jamais pour
 * fusionner des fiches ou authentifier un·e candidat·e.
 *
 * Le zéro national après +33 est parfois saisi dans « +33 (0)6 ... ».
 */
export function normalizeTelephoneForDuplicate(value: string | null): string | null {
  if (!value) return null;
  let normalized = value.trim().replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(normalized)) return null;

  // Les formes nationales et internationales françaises pointent sur la
  // même chaîne, contrairement aux simples comparaisons de texte.
  if (normalized.startsWith("0033")) normalized = `0${normalized.slice(4).replace(/^0/, "")}`;
  else if (normalized.startsWith("+33")) normalized = `0${normalized.slice(3).replace(/^0/, "")}`;
  else if (normalized.startsWith("00")) normalized = `+${normalized.slice(2)}`;

  // Numéro incomplet, placeholder ou numérotation fantaisiste : éviter des
  // alertes de doublon en masse sur des données de test ou anciennes fiches.
  const digits = normalized.replace(/^\+/, "");
  if (digits.length < 9 || digits.length > 15 || new Set(digits).size <= 1) return null;
  return normalized;
}
