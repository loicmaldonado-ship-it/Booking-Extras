// Numéro au format international (+33…) pour Messages / Raccourcis. Les
// numéros français à 10 chiffres (06…, 07…) sont convertis ; renvoie null
// si ce n'est visiblement pas un numéro de portable joignable.
export function telephoneInternational(brut: string | null | undefined): string | null {
  if (!brut) return null;
  const garde = brut.trim();
  const chiffres = garde.replace(/\D/g, "");
  if (garde.startsWith("+")) return chiffres.length >= 8 && chiffres.length <= 15 ? `+${chiffres}` : null;
  if (chiffres.startsWith("00")) return chiffres.length >= 10 ? `+${chiffres.slice(2)}` : null;
  if (chiffres.length === 10 && chiffres.startsWith("0")) return `+33${chiffres.slice(1)}`;
  if (chiffres.length === 11 && chiffres.startsWith("33")) return `+${chiffres}`;
  return null;
}

// `cle` : identifiant libre de l'appelant, renvoyé dans onEnvoye.
export type DestinataireTexto = { nom: string; telephone: string | null; texte: string; cle?: string };
