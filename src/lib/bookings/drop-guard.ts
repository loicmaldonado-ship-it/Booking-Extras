/** Untrusted booking selection: prevent forged references and unbounded inserts. */
export const MAX_BOOKING_DROP_ROWS = 1500;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidBookingDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function validateBookingDropSelection(figurantIds: unknown, dates: unknown, references?: unknown):
  | { ok: true }
  | { ok: false; error: string } {
  if (!Array.isArray(figurantIds) || !Array.isArray(dates) ||
      figurantIds.length * dates.length > MAX_BOOKING_DROP_ROWS) {
    return { ok: false, error: "Sélection de bookings trop importante (1 500 lignes maximum)." };
  }
  if (!figurantIds.every((id) => typeof id === "string" && UUID.test(id)) ||
      new Set(figurantIds.map((id) => id.toLowerCase())).size !== figurantIds.length ||
      !dates.every(isValidBookingDate) || new Set(dates).size !== dates.length) {
    return { ok: false, error: "Sélection de figurants ou de dates invalide." };
  }
  if (references !== undefined) {
    if (typeof references !== "object" || references === null || Array.isArray(references)) {
      return { ok: false, error: "Références de candidature invalides." };
    }
    const values = Object.values(references);
    if (Object.keys(references).some((id) => !figurantIds.includes(id)) ||
        values.some((id) => typeof id !== "string" || !UUID.test(id)) ||
        new Set(values.map((x) => String(x).toLowerCase())).size !== values.length) {
      return { ok: false, error: "Références de candidature incohérentes." };
    }
  }
  return { ok: true };
}
