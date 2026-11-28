// Un nom ou un email saisi est une valeur littérale, jamais un motif SQL LIKE : sans échappement, « % » ou « _ »
// dans un formulaire public servaient de jokers (audit du 31/10/2026 : énumération d'emails, fiche d'un·e autre
// retrouvée par téléphone seul). À utiliser pour tout .ilike() de comparaison exacte insensible à la casse.
export function echapperMotif(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
