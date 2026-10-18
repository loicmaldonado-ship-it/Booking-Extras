"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

// Fonctions enregistrées d'un projet, en ordre alphabétique. Elles
// s'ajoutent d'office dès qu'une fonction est saisie (booking, besoins,
// candidature — voir la migration fonctions_projet).
export async function listerFonctionsProjet(projetId: string | null | undefined): Promise<string[]> {
  if (!projetId) return [];
  if (await checkProjetAccess(projetId)) return [];
  const { data } = await createAdminClient().from("projet_fonctions").select("nom").eq("projet_id", projetId);
  return (data ?? []).map((f) => f.nom).sort(collator.compare);
}

// Retire une fonction de la liste proposée (faute de frappe, fonction
// abandonnée). Les bookings qui la portent ne sont pas modifiés.
export async function oublierFonctionProjet(projetId: string, nom: string): Promise<{ error?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const { error } = await createAdminClient()
    .from("projet_fonctions")
    .delete()
    .eq("projet_id", projetId)
    .ilike("nom", nom.replace(/[\\%_]/g, "\\$&"));
  if (error) return { error: error.message };
  revalidatePath("/bookings/documents");
  return {};
}
