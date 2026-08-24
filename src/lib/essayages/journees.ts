import { createAdminClient } from "@/lib/supabase/admin";

export type EssayageJournee = {
  id: string;
  projet_id: string;
  date: string;
  lieu: string | null;
  adresse: string | null;
  numero: number;
  total: number;
  propose: number;
  confirme: number;
  fait: number;
};

export async function getEssayageJournees(projetId?: string): Promise<EssayageJournee[]> {
  const supabase = createAdminClient();

  let journeesQuery = supabase
    .from("essayage_journees")
    .select("id, projet_id, date, lieu, adresse")
    .order("date", { ascending: true });
  if (projetId) journeesQuery = journeesQuery.eq("projet_id", projetId);

  let essayagesQuery = supabase.from("essayages").select("essayage_journee_id, statut");
  if (projetId) essayagesQuery = essayagesQuery.eq("projet_id", projetId);

  const [{ data: journeesRaw }, { data: essayagesRaw }] = await Promise.all([
    journeesQuery,
    essayagesQuery.returns<{ essayage_journee_id: string | null; statut: string }[]>(),
  ]);

  const counts = new Map<string, { total: number; propose: number; confirme: number; fait: number }>();
  for (const e of essayagesRaw ?? []) {
    if (!e.essayage_journee_id) continue;
    const existing = counts.get(e.essayage_journee_id) ?? { total: 0, propose: 0, confirme: 0, fait: 0 };
    existing.total += 1;
    if (e.statut === "proposé") existing.propose += 1;
    if (e.statut === "confirmé") existing.confirme += 1;
    if (e.statut === "fait") existing.fait += 1;
    counts.set(e.essayage_journee_id, existing);
  }

  return (journeesRaw ?? []).map((j, i) => {
    const c = counts.get(j.id) ?? { total: 0, propose: 0, confirme: 0, fait: 0 };
    return {
      id: j.id,
      projet_id: j.projet_id,
      date: j.date,
      lieu: j.lieu,
      adresse: j.adresse,
      numero: i + 1,
      total: c.total,
      propose: c.propose,
      confirme: c.confirme,
      fait: c.fait,
    };
  });
}
