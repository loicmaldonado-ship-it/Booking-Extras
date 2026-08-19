"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const { error } = await supabase
    .from("journee_besoins")
    .upsert({ journee_id: journeeId, fonction, quantite }, { onConflict: "journee_id,fonction" });

  if (error) return { error: error.message };
  revalidatePath("/bookings/documents");
  return { success: true as const };
}

export async function deleteBesoin(id: string) {
  const supabase = createAdminClient();
  await supabase.from("journee_besoins").delete().eq("id", id);
  revalidatePath("/bookings/documents");
}
