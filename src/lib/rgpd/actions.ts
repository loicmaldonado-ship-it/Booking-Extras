"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChef } from "@/lib/auth/session";

// Action manuelle, déclenchée un profil à la fois par la cheffe de casting
// depuis /rgpd — aucune tâche planifiée n'appelle cette fonction. Les
// mensurations/bookings passés sont conservés (comptabilité, historique de
// tournage) ; seules les données directement identifiantes sont effacées.
export async function anonymiserFigurant(id: string) {
  await requireChef();

  const supabase = createAdminClient();

  const { data: photos } = await supabase
    .from("figurant_photos")
    .select("id, storage_path")
    .eq("figurant_id", id);

  if (photos && photos.length > 0) {
    await supabase.storage.from("figurant-photos").remove(photos.map((p) => p.storage_path));
    await supabase.from("figurant_photos").delete().eq("figurant_id", id);
  }

  await supabase.from("figurant_liens").delete().eq("figurant_id", id);

  const { error } = await supabase
    .from("figurants")
    .update({
      prenom: "Profil",
      nom: "anonymisé",
      email: null,
      telephone: null,
      adresse: null,
      ville: null,
      commune_naissance: null,
      notes_internes: null,
      tags: [],
      anonymise: true,
      anonymise_le: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/rgpd");
  revalidatePath("/figurants");
  return { success: true as const };
}
