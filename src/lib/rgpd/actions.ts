"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChef } from "@/lib/auth/session";

// Action manuelle, déclenchée un profil à la fois par la cheffe de casting
// depuis /rgpd — aucune tâche planifiée n'appelle cette fonction. Les
// mensurations/bookings passés sont conservés (comptabilité, historique de
// tournage) ; seules les données directement identifiantes sont effacées.
export async function anonymiserFigurant(id: string) {
  const actor = await requireChef();
  if (!actor.isOwner) return { error: "L’anonymisation globale est réservée au compte propriétaire." };

  const supabase = createAdminClient();

  const { data: photos } = await supabase
    .from("figurant_photos")
    .select("id, storage_path")
    .eq("figurant_id", id);

  if (photos && photos.length > 0) {
    const { error: storageError } = await supabase.storage.from("figurant-photos").remove(photos.map((p) => p.storage_path));
    if (storageError) return { error: "Suppression des médias impossible. Aucune anonymisation confirmée." };
    const { error: photosError } = await supabase.from("figurant_photos").delete().eq("figurant_id", id);
    if (photosError) return { error: "Suppression des références photo impossible. Réessaie." };
  }

  const { error: linksError } = await supabase.from("figurant_liens").delete().eq("figurant_id", id);
  if (linksError) return { error: "Suppression des liens impossible. Réessaie." };
  const { error: accessError } = await supabase.from("figurants").update({ acces_compte: false }).eq("id", id);
  if (accessError) return { error: "Révocation de l’accès impossible. Réessaie." };
  for (const table of ["figurant_sessions", "figurant_auth_tokens", "figurant_comptes", "minor_guardians"]) {
    const { error: authError } = await supabase.from(table).delete().eq("figurant_id", id);
    if (authError) return { error: "Nettoyage des accès incomplet. Réessaie." };
  }

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
