import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "./types";

// Émet un événement dans le flux de notifications staff. Appelé depuis les
// points du code où l'événement se produit réellement (candidature
// soumise, réponse d'un candidat, première connexion à /compte) — jamais
// recalculé après coup.
export async function createNotification(
  type: NotificationType,
  titre: string,
  opts?: { figurantId?: string | null; projetId?: string | null; annonceId?: string | null; lien?: string | null }
) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("notifications").insert({
      type,
      titre,
      figurant_id: opts?.figurantId ?? null,
      projet_id: opts?.projetId ?? null,
      annonce_id: opts?.annonceId ?? null,
      lien: opts?.lien ?? null,
    });
    if (!error) return {};
  } catch {
    // La notification est secondaire : ne pas masquer une opération déjà enregistrée.
  }
  console.error("[notifications] Enregistrement impossible.");
  return { error: "Notification non enregistrée." };
}
