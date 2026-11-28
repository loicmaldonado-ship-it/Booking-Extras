// Validation côté serveur d'une action de mise à jour groupée.
// Aucune requête utilisant service_role n'est exécutée avec une sélection
// absente, dupliquée, malformée ou excessivement grande.
export const MAX_CASTING_BULK_UPDATE = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateCastingBulkStatusRequest(
  entryIds: unknown,
  statut: unknown,
  allowedStatuses: readonly string[]
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(entryIds) || entryIds.length === 0) {
    return { ok: false, error: "Aucun profil sélectionné." };
  }
  if (entryIds.length > MAX_CASTING_BULK_UPDATE) {
    return { ok: false, error: `Sélection limitée à ${MAX_CASTING_BULK_UPDATE} profils par opération.` };
  }
  if (typeof statut !== "string" || !allowedStatuses.includes(statut)) {
    return { ok: false, error: "Statut invalide." };
  }
  if (entryIds.some((id) => typeof id !== "string" || !UUID.test(id))) {
    return { ok: false, error: "Sélection de profils invalide." };
  }
  const ids: string[] = entryIds.map((id: string) => id.toLowerCase());
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: "La sélection contient des doublons." };
  }
  return { ok: true, ids };
}
