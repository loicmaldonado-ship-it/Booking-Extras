import { createAdminClient } from "@/lib/supabase/admin";

export type FigurantInactif = {
  id: string;
  prenom: string;
  nom: string;
  email: string | null;
  derniereActivite: string | null;
};

// Aucune tâche planifiée n'appelle cette fonction : c'est une consultation
// à la demande, pour préparer une anonymisation manuelle (voir actions.ts).
export async function getFigurantsInactifs(seuilAns: number): Promise<FigurantInactif[]> {
  const supabase = createAdminClient();
  const seuilDate = new Date();
  seuilDate.setFullYear(seuilDate.getFullYear() - seuilAns);
  const seuilIso = seuilDate.toISOString().slice(0, 10);

  const { data: figurants } = await supabase
    .from("figurants")
    .select("id, prenom, nom, email, updated_at")
    .eq("anonymise", false);

  if (!figurants || figurants.length === 0) return [];

  const ids = figurants.map((f) => f.id);

  const [{ data: bookings }, { data: candidatures }] = await Promise.all([
    supabase.from("bookings").select("figurant_id, date").in("figurant_id", ids),
    supabase.from("candidatures").select("figurant_id, created_at").in("figurant_id", ids),
  ]);

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
      derniereActivite: lastByFigurant.get(f.id) ?? null,
    }))
    .filter((f) => f.derniereActivite !== null && f.derniereActivite < seuilIso)
    .sort((a, b) => (a.derniereActivite ?? "").localeCompare(b.derniereActivite ?? ""));
}
