import { createAdminClient } from "@/lib/supabase/admin";

export type JourneeBesoin = {
  id: string;
  journee_id: string;
  fonction: string;
  quantite: number;
};

export async function getBesoinsByJournee(journeeId: string): Promise<JourneeBesoin[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("journee_besoins")
    .select("*")
    .eq("journee_id", journeeId)
    .order("fonction")
    .returns<JourneeBesoin[]>();
  return data ?? [];
}
