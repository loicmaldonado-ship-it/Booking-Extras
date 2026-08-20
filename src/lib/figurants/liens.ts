import { createAdminClient } from "@/lib/supabase/admin";

// Un seul lien par label et par figurant (contrairement à figurant_liens
// géré à la main par le staff, qui autorise plusieurs lignes du même label).
// Utilisé pour les champs fixes de l'espace personnel (bande démo, Instagram).
export async function upsertFigurantLienByLabel(
  supabase: ReturnType<typeof createAdminClient>,
  figurantId: string,
  label: string,
  url: string | null
) {
  const { data: existing } = await supabase
    .from("figurant_liens")
    .select("id")
    .eq("figurant_id", figurantId)
    .eq("label", label)
    .maybeSingle();

  if (!url) {
    if (existing) await supabase.from("figurant_liens").delete().eq("id", existing.id);
    return;
  }
  if (existing) {
    await supabase.from("figurant_liens").update({ url }).eq("id", existing.id);
  } else {
    await supabase.from("figurant_liens").insert({ figurant_id: figurantId, label, url });
  }
}
