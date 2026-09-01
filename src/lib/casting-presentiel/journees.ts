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
