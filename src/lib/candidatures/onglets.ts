import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CandidatureOnglet } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Onglets communs + ceux propres à cette annonce. L'id vient de l'URL et
// finit dans un filtre PostgREST `.or()` : validé en UUID avant.
export async function getOngletsForAnnonce(annonceId: string | null | undefined): Promise<CandidatureOnglet[]> {
  const supabase = createAdminClient();
  let query = supabase.from("candidature_onglets").select("id, nom, couleur, fixe, ordre, annonce_id").order("ordre");
  query =
    annonceId && UUID_RE.test(annonceId)
      ? query.or(`annonce_id.is.null,annonce_id.eq.${annonceId}`)
      : query.is("annonce_id", null);
  const { data } = await query.returns<CandidatureOnglet[]>();
  return data ?? [];
}

// Nombre de tournages différents sur lesquels chaque personne a été
// confirmée. Découpé par paquets : un `.in()` sur des centaines d'UUID
// dépasse la longueur d'URL acceptée par PostgREST.
export async function getTournagesConfirmesCount(figurantIds: string[]): Promise<Map<string, number>> {
  const supabase = createAdminClient();
  const projetsByFigurant = new Map<string, Set<string>>();
  const ids = Array.from(new Set(figurantIds));
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase
      .from("bookings")
      .select("figurant_id, projet_id")
      .eq("statut", "confirmé")
      .in("figurant_id", ids.slice(i, i + 150));
    for (const b of data ?? []) {
      const set = projetsByFigurant.get(b.figurant_id) ?? new Set<string>();
      set.add(b.projet_id);
      projetsByFigurant.set(b.figurant_id, set);
    }
  }
  return new Map(Array.from(projetsByFigurant, ([id, set]) => [id, set.size]));
}
