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
  // BUG-13 : renvoie l'erreur au lieu de l'ignorer ; à l'appelant de décider si elle bloque.
  const { data: existing, error: readError } = await supabase
    .from("figurant_liens")
    .select("id")
    .eq("figurant_id", figurantId)
    .eq("label", label)
    .maybeSingle();
  if (readError) return { error: readError.message };

  if (!url) {
    if (!existing) return {};
    const { error } = await supabase.from("figurant_liens").delete().eq("id", existing.id);
    return error ? { error: error.message } : {};
  }
  // Audit du 31/10/2026 : un lien saisi par la personne est affiché comme lien cliquable côté équipe ; seules les
  // adresses web http(s) sont acceptées (pas de « javascript: », « data: »…).
  // Une adresse saisie sans protocole (« instagram.com/… ») est complétée en https://.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
  if (!/^https?:\/\/[^\s]+$/i.test(url)) return { error: "Le lien doit commencer par https://" };
  const { error } = existing
    ? await supabase.from("figurant_liens").update({ url }).eq("id", existing.id)
    : await supabase.from("figurant_liens").insert({ figurant_id: figurantId, label, url });
  return error ? { error: error.message } : {};
}
