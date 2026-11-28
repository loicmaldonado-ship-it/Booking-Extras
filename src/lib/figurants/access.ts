import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// A service-role mutation must first check the request's actual row visibility.
export async function checkVisibleFigurants(ids: string[]): Promise<string | null> {
  if (!Array.isArray(ids) || ids.length > 1500 || ids.some((id) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    return "Sélection de profils invalide.";
  }
  const unique = [...new Set(ids.filter(Boolean).map((id) => id.toLowerCase()))];
  if (unique.length === 0) return null;
  const client = await createServerSupabaseClient();
  // Booking drops can contain 1,500 people; never rely on the API's row cap.
  for (let offset = 0; offset < unique.length; offset += 400) {
    const batch = unique.slice(offset, offset + 400);
    const { data, error } = await client.from("figurants").select("id").in("id", batch);
    if (error || !data) return "Un profil est introuvable ou inaccessible.";
    if (data.length === batch.length) continue;
    // Sans la section Base Profils, une personne de la base partagée reste choisissable (noms seuls, figurants_choix).
    const vus = new Set(data.map((r) => r.id as string));
    const manquants = batch.filter((id) => !vus.has(id));
    try {
      const { data: choix, error: choixError } = await client.rpc("figurants_choix", { p_ids: manquants });
      if (choixError || (choix ?? []).length !== manquants.length) return "Un profil est introuvable ou inaccessible.";
    } catch {
      return "Un profil est introuvable ou inaccessible.";
    }
  }
  return null;
}
