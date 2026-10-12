// BUG-15: A public upload token only authorizes files for its specific entry.
// Never accept a client-supplied Storage path without checking its structure.
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

export function castingVideoPathValid(path: unknown, figurantId: string, entryId: string, nbVideos: number): boolean {
  if (typeof path !== "string") return false;
  const prefix = `${figurantId}/${entryId}-video-`;
  if (!path.startsWith(prefix)) return false;
  const match = new RegExp(`^([0-9]+)-(${UUID})\\.mp4$`, "i").exec(path.slice(prefix.length));
  return !!match && Number.isSafeInteger(Number(match[1])) && Number(match[1]) < nbVideos;
}

export function castingPhotoPathValid(path: unknown, figurantId: string, entryId: string, label: string): boolean {
  if (typeof path !== "string") return false;
  const prefix = `${figurantId}/casting-${entryId}-${encodeURIComponent(label)}-`;
  if (!path.startsWith(prefix)) return false;
  return new RegExp(`^${UUID}\\.jpg$`, "i").test(path.slice(prefix.length));
}

export function isCastingSubmissionLocked(entry: { submitted_at: string | null; statut: string }): boolean {
  return !!entry.submitted_at || ["attente_validation", "valide", "confirmé", "indisponible", "annulé"].includes(entry.statut);
}
