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
  opts?: { figurantId?: string | null; projetId?: string | null; lien?: string | null }
) {
  const supabase = createAdminClient();
  await supabase.from("notifications").insert({
    type,
    titre,
    figurant_id: opts?.figurantId ?? null,
    projet_id: opts?.projetId ?? null,
    lien: opts?.lien ?? null,
  });
}
