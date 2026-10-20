import { CACHETS } from "@/lib/candidatures/types";
import { COVOITURAGE_ROLES, STATUTS } from "./types";

/** Validate all user-controlled bulk edits before bypassing RLS with service_role. */
export const MAX_BOOKING_BULK_UPDATE = 150;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statuts = new Set<string>(STATUTS.map((s) => s.value));
const cachets = new Set<string>(CACHETS);
const covoiturageRoles = new Set<string>(COVOITURAGE_ROLES.map((r) => r.value));
const textFields = new Set([
  "fonction", "heure_convocation", "covoiturage_lieu_depart", "notes",
]);
const editable = new Set([
  ...textFields, "statut", "cachet", "covoiturage_role", "covoiturage_places_disponibles",
  "covoiturage_conducteur_id", "reponse_recue",
]);

export function validateBookingBulkIds(value: unknown):
  | { ok: true; ids: string[] }
  | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length > MAX_BOOKING_BULK_UPDATE ||
      !value.every((id) => typeof id === "string" && UUID.test(id))) {
    return { ok: false, error: "Sélection invalide (150 bookings maximum)." };
  }
  if (new Set(value.map((id) => id.toLowerCase())).size !== value.length) {
    return { ok: false, error: "Un booking apparaît plusieurs fois dans la sélection." };
  }
  return { ok: true, ids: value as string[] };
}

export function validateBookingBulkChanges(value: unknown):
  | { ok: true; changes: Record<string, string | number | boolean | null> }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Modification de bookings invalide." };
  }
  const entries = Object.entries(value);
  if (entries.length === 0 || entries.some(([field]) => !editable.has(field))) {
    return { ok: false, error: "Champ de booking non autorisé ou absent." };
  }
  const changes: Record<string, string | number | boolean | null> = {};
  for (const [field, v] of entries) {
    let valid = false;
    if (textFields.has(field)) {
      valid = v === null || (typeof v === "string" && v.length <= (field === "notes" ? 4000 : 250));
      if (field === "heure_convocation" && v !== null) {
        valid = typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(v);
      }
    } else if (field === "statut") valid = typeof v === "string" && statuts.has(v);
    else if (field === "cachet") valid = v === null || (typeof v === "string" && cachets.has(v));
    else if (field === "covoiturage_role") valid = v === null || (typeof v === "string" && covoiturageRoles.has(v));
    else if (field === "covoiturage_conducteur_id") valid = v === null || (typeof v === "string" && UUID.test(v));
    else if (field === "covoiturage_places_disponibles") {
      valid = v === null || (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 99);
    } else if (field === "reponse_recue") valid = typeof v === "boolean";
    if (!valid) return { ok: false, error: `Valeur invalide pour ${field}.` };
    changes[field] = v as string | number | boolean | null;
  }
  return { ok: true, changes };
}
