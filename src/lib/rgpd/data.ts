import "server-only";
import { getCurrentProfile } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

export type FigurantInactif = {
  id: string;
  prenom: string;
  nom: string;
  email: string | null;
  derniereActivite: string | null;
  effacementEnCours: boolean;
};

// Aucune tâche planifiée n'appelle cette fonction : c'est une consultation
// à la demande, pour préparer une anonymisation manuelle (voir actions.ts).
export async function getFigurantsInactifs(seuilAns: number): Promise<FigurantInactif[]> {
  const actor = await getCurrentProfile();
  if (!actor?.isOwner || actor.role !== "chef") return [];
  const supabase = createAdminClient();
  const seuilDate = new Date();
  seuilDate.setFullYear(seuilDate.getFullYear() - seuilAns);
  const seuilIso = seuilDate.toISOString().slice(0, 10);

  const { data: figurants, error: figurantsError, count: figurantsCount } = await supabase
    .from("figurants")
    .select("id, prenom, nom, email, updated_at, anonymisation_en_cours_at", { count: "exact" })
    .eq("anonymise", false);

  if (figurantsError || !figurants) throw new Error("Liste des profils indisponible.");
  if (figurantsCount === null || figurantsCount !== figurants.length) throw new Error("Liste des profils incomplète.");
  if (figurants.length === 0) return [];

  const ids = figurants.map((f) => f.id);

  const [{ data: bookings, error: bookingsError, count: bookingsCount }, { data: candidatures, error: candidaturesError, count: candidaturesCount }] = await Promise.all([
    supabase.from("bookings").select("figurant_id, date", { count: "exact" }).in("figurant_id", ids),
    supabase.from("candidatures").select("figurant_id, created_at", { count: "exact" }).in("figurant_id", ids),
  ]);

  if (bookingsError || candidaturesError || !bookings || !candidatures) {
    throw new Error("Historique des profils indisponible.");
  }

  if (bookingsCount === null || candidaturesCount === null || bookingsCount !== bookings.length || candidaturesCount !== candidatures.length) {
    throw new Error("Historique des profils incomplet.");
  }

  const lastByFigurant = new Map<string, string>();
  for (const f of figurants) {
    if (f.updated_at) lastByFigurant.set(f.id, f.updated_at.slice(0, 10));
  }
  for (const b of bookings ?? []) {
    const current = lastByFigurant.get(b.figurant_id);
    if (!current || b.date > current) lastByFigurant.set(b.figurant_id, b.date);
  }
  for (const c of candidatures ?? []) {
    const date = c.created_at.slice(0, 10);
    const current = lastByFigurant.get(c.figurant_id);
    if (!current || date > current) lastByFigurant.set(c.figurant_id, date);
  }

  return figurants
    .map((f) => ({
      id: f.id,
      prenom: f.prenom,
      nom: f.nom,
      email: f.email,
      effacementEnCours: f.anonymisation_en_cours_at !== null,
      derniereActivite: lastByFigurant.get(f.id) ?? null,
    }))
    .filter((f) => f.effacementEnCours || (f.derniereActivite !== null && f.derniereActivite < seuilIso))
    .sort((a, b) => (a.derniereActivite ?? "").localeCompare(b.derniereActivite ?? ""));
}
