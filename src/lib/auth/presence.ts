// Marge volontairement plus large que le throttle de 5 min appliqué dans
// getCurrentProfile() — sinon une personne active en continu apparaîtrait
// "hors ligne" entre deux écritures.
export const ONLINE_THRESHOLD_MS = 10 * 60 * 1000;

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}
