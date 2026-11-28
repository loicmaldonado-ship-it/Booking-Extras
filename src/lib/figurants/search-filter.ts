/**
 * PostgREST .or() accepts raw filter syntax, not parameterized predicates.
 * Build it from a strict allow-list of columns and sanitized user terms.
 * All search terms must match somewhere (e.g. first name + last name).
 */
const SEARCH_FIELDS = ["nom", "prenom", "email", "telephone"] as const;
const MAX_SEARCH_LENGTH = 90;
const MAX_TERMS = 4;

export function buildProfileSearchFilter(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").slice(0, MAX_SEARCH_LENGTH)
    // Commas, parentheses and wildcards are structural in a PostgREST .or.
    .replace(/[,()\\"%*_]/g, " ")
    .replace(/[^\p{L}\p{N}\s@.+’'-]/gu, " ")
    .trim();
  const terms = normalized.split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
  if (terms.length === 0) return null;
  const anyColumn = (term: string) => SEARCH_FIELDS.map((col) => `${col}.ilike.*${term}*`).join(",");
  if (terms.length === 1) return anyColumn(terms[0]);
  return `and(${terms.map((term) => `or(${anyColumn(term)})`).join(",")})`;
}
