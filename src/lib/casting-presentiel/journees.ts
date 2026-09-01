import { createAdminClient } from "@/lib/supabase/admin";

export type PresentielJournee = {
  id: string;
  projet_id: string;
  date: string;
  lieu: string | null;
  numero: number;
  total: number;
  confirmes: number;
  valides: number;
};

export type PresentielJourneeAvecCreneaux = {
  id: string;
  date: string;
  creneaux: { id: string; heure_debut: string; heure_fin: string }[];
};

// Version légère (pas de comptage bookings) pour le panneau "Envoyer au
// planning présentiel" depuis /casting — juste de quoi peupler les deux
// menus déroulants journée puis créneau.
export async function getPresentielJourneesWithCreneaux(projetId: string): Promise<PresentielJourneeAvecCreneaux[]> {
  const supabase = createAdminClient();
  const { data: journees } = await supabase
    .from("casting_presentiel_journees")
    .select("id, date")
    .eq("projet_id", projetId)
    .order("date", { ascending: true });
  if (!journees || journees.length === 0) return [];

  const { data: creneaux } = await supabase
    .from("casting_presentiel_creneaux")
    .select("id, journee_id, heure_debut, heure_fin")
    .in("journee_id", journees.map((j) => j.id))
    .order("heure_debut")
    .returns<{ id: string; journee_id: string; heure_debut: string; heure_fin: string }[]>();

  const creneauxByJournee = new Map<string, { id: string; heure_debut: string; heure_fin: string }[]>();
  for (const c of creneaux ?? []) {
    const list = creneauxByJournee.get(c.journee_id) ?? [];
    list.push({ id: c.id, heure_debut: c.heure_debut, heure_fin: c.heure_fin });
    creneauxByJournee.set(c.journee_id, list);
  }

  return journees.map((j) => ({ id: j.id, date: j.date, creneaux: creneauxByJournee.get(j.id) ?? [] }));
}

export async function getPresentielJournees(projetId?: string): Promise<PresentielJournee[]> {
  const supabase = createAdminClient();

  let journeesQuery = supabase
    .from("casting_presentiel_journees")
    .select("id, projet_id, date, lieu")
    .order("date", { ascending: true });
  if (projetId) journeesQuery = journeesQuery.eq("projet_id", projetId);

  let entriesQuery = supabase.from("casting_presentiel_entries").select("journee_id, statut");
  if (projetId) entriesQuery = entriesQuery.eq("projet_id", projetId);

  const [{ data: journeesRaw }, { data: entriesRaw }] = await Promise.all([
    journeesQuery,
    entriesQuery.returns<{ journee_id: string; statut: string }[]>(),
  ]);

  const counts = new Map<string, { total: number; confirmes: number; valides: number }>();
  for (const e of entriesRaw ?? []) {
    const existing = counts.get(e.journee_id) ?? { total: 0, confirmes: 0, valides: 0 };
    existing.total += 1;
    if (e.statut === "confirmé") existing.confirmes += 1;
    if (e.statut === "valide") existing.valides += 1;
    counts.set(e.journee_id, existing);
  }

  return (journeesRaw ?? []).map((j, i) => {
    const c = counts.get(j.id) ?? { total: 0, confirmes: 0, valides: 0 };
    return {
      id: j.id,
      projet_id: j.projet_id,
      date: j.date,
      lieu: j.lieu,
      numero: i + 1,
      total: c.total,
      confirmes: c.confirmes,
      valides: c.valides,
    };
  });
}
