"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireChef } from "@/lib/auth/session";

type Result = { success: true } | { error: string; refresh?: boolean };
type FileToErase = { bucket: string; path: string };

// La base retire les accès et conserve le plan de suppression avant le retrait
// des fichiers. Une interruption laisse un travail reprenable, jamais un succès.
export async function anonymiserFigurant(id: string): Promise<Result> {
  const actor = await requireChef();
  if (!actor.isOwner) return { error: "L’anonymisation globale est réservée au compte propriétaire." };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("preparer_effacement_figurant", { p_id: id, p_actor: actor.id });
  if (error) return { error: "Préparation de l’effacement impossible. Aucune réussite confirmée." };
  const interrupted = (): Result => {
    revalidatePath("/rgpd");
    revalidatePath("/figurants");
    return { error: "Accès révoqués, nettoyage des fichiers incomplet. Reprends le nettoyage depuis cette page.", refresh: true };
  };
  try {
    if (!data || !Array.isArray(data.files)) return interrupted();
    const groups = new Map<string, string[]>();
    for (const file of data.files as FileToErase[]) {
      if (!["figurant-photos", "casting-videos", "minor-documents"].includes(file.bucket) || typeof file.path !== "string" || !file.path) return interrupted();
      groups.set(file.bucket, [...(groups.get(file.bucket) ?? []), file.path]);
    }
    for (const [bucket, paths] of groups) {
      for (let offset = 0; offset < paths.length; offset += 100) {
        const { error: removalError } = await admin.storage.from(bucket).remove(paths.slice(offset, offset + 100));
        if (removalError) return interrupted();
      }
    }
    const { error: finishError } = await admin.rpc("terminer_effacement_figurant", { p_id: id, p_actor: actor.id });
    if (finishError) return interrupted();
  } catch {
    return interrupted();
  }
  revalidatePath("/rgpd");
  revalidatePath("/figurants");
  return { success: true };
}
