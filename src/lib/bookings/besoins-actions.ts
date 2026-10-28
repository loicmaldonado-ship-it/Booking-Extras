"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

export async function addBesoin(journeeId: string, _prevState: unknown, formData: FormData) {
  const fonction = str(formData, "fonction");
  const quantiteRaw = str(formData, "quantite");
  const quantite = quantiteRaw ? Number(quantiteRaw) : null;

  if (!fonction) return { error: "Fonction requise." };
  if (!quantite || quantite <= 0) return { error: "Quantité invalide." };

  const supabase = createAdminClient();
  const { data: journee, error: lookupError } = await supabase.from("journees").select("projet_id").eq("id", journeeId).maybeSingle();
  if (lookupError || !journee) return { error: "Impossible de vérifier cette journée." };
  const accessError = await checkProjetAccess(journee.projet_id);
  if (accessError) return { error: accessError };
  const { error } = await supabase
    .from("journee_besoins")
    .upsert({ journee_id: journeeId, fonction, quantite }, { onConflict: "journee_id,fonction" });

  if (error) return { error: error.message };
  revalidatePath("/bookings/documents");
  return { success: true as const };
}

export async function deleteBesoin(id: string) {
  const supabase = createAdminClient();
  const { data: besoin, error: besoinError } = await supabase.from("journee_besoins").select("journee_id").eq("id", id).maybeSingle();
  if (besoinError || !besoin) throw new Error("Impossible de vérifier ce besoin.");
  const { data: journee, error: journeeError } = await supabase.from("journees").select("projet_id").eq("id", besoin.journee_id).maybeSingle();
  if (journeeError || !journee) throw new Error("Impossible de vérifier cette journée.");
  const accessError = await checkProjetAccess(journee.projet_id);
  if (accessError) throw new Error(accessError);
  const { error } = await supabase.from("journee_besoins").delete().eq("id", id);
  if (error) throw new Error("Impossible de supprimer ce besoin.");
  revalidatePath("/bookings/documents");
}

// Modifie une fonction déjà créée (nom et/ou quantité). En cas de
// renommage, les bookings de la journée qui portaient l'ancien nom peuvent
// suivre — sinon ils ne seraient plus comptés dans ce besoin.
export async function updateBesoin(
  id: string,
  fonction: string,
  quantite: number,
  renommerBookings: boolean
): Promise<{ error?: string; renommes?: number }> {
  const nom = fonction.trim();
  if (!nom) return { error: "Fonction requise." };
  if (!Number.isInteger(quantite) || quantite <= 0) return { error: "Quantité invalide." };

  const supabase = createAdminClient();
  const { data: besoin } = await supabase
    .from("journee_besoins")
    .select("journee_id, fonction, journees(projet_id, date)")
    .eq("id", id)
    .maybeSingle<{ journee_id: string; fonction: string; journees: { projet_id: string; date: string } | null }>();
  if (!besoin?.journees) return { error: "Besoin introuvable." };
  const accessError = await checkProjetAccess(besoin.journees.projet_id);
  if (accessError) return { error: accessError };

  const { error } = await supabase.from("journee_besoins").update({ fonction: nom, quantite }).eq("id", id);
  if (error) {
    if (error.code === "23505") return { error: `La fonction « ${nom} » existe déjà pour cette journée.` };
    return { error: error.message };
  }

  let renommes = 0;
  const ancien = besoin.fonction.trim().toLowerCase();
  if (renommerBookings && ancien !== nom.toLowerCase()) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, fonction")
      .eq("projet_id", besoin.journees.projet_id)
      .eq("date", besoin.journees.date)
      .not("fonction", "is", null);
    const ids = (bookings ?? []).filter((b) => b.fonction!.trim().toLowerCase() === ancien).map((b) => b.id);
    if (ids.length > 0) {
      const { error: errBookings } = await supabase.from("bookings").update({ fonction: nom }).in("id", ids);
      if (errBookings) return { error: errBookings.message };
      renommes = ids.length;
    }
  }

  revalidatePath("/bookings/documents");
  return { renommes };
}
