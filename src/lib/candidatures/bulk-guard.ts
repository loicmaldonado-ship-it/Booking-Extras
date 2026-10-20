/** Validate untrusted IDs before any service_role bulk mutation. */
export const MAX_CANDIDATURE_BULK_UPDATE = 150;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateCandidatureBulkIds(value: unknown):
  | { ok: true; ids: string[] }
  | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length > MAX_CANDIDATURE_BULK_UPDATE) {
    return { ok: false, error: "Sélection invalide ou trop importante (150 candidatures maximum)." };
  }
  if (!value.every((id) => typeof id === "string" && UUID.test(id))) {
    return { ok: false, error: "Identifiant de candidature invalide." };
  }
  const ids = value as string[];
  if (new Set(ids.map((id) => id.toLowerCase())).size !== ids.length) {
    return { ok: false, error: "Une candidature apparaît plusieurs fois dans la sélection." };
  }
  return { ok: true, ids };
}
