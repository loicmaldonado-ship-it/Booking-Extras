"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";

export type Etiquette = { id: string; nom: string };

const MAX_NOM = 40;

async function projetDeLAnnonce(annonceId: string): Promise<string | null> {
  const { data } = await createAdminClient().from("annonces").select("projet_id").eq("id", annonceId).maybeSingle();
  return data?.projet_id ?? null;
}

// Étiquettes d'un projet (Vélo, Gueules…) : communes à toutes ses annonces.
// Créée une seule fois, quelle que soit la casse (« vélo » = « Vélo »).
export async function creerEtiquette(annonceId: string, nom: string): Promise<{ error?: string; etiquette?: Etiquette }> {
  const propre = nom.trim().replace(/\s+/g, " ").slice(0, MAX_NOM);
  if (!propre) return { error: "Nom d'étiquette requis." };
  const projetId = await projetDeLAnnonce(annonceId);
  if (!projetId) return { error: "Annonce introuvable." };
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { data: existante } = await supabase
    .from("candidature_etiquettes")
    .select("id, nom")
    .eq("projet_id", projetId)
    .ilike("nom", propre.replace(/[\\%_]/g, "\\$&"))
    .maybeSingle();
  if (existante) return { etiquette: existante };
  const { data, error } = await supabase
    .from("candidature_etiquettes")
    .insert({ projet_id: projetId, nom: propre })
    .select("id, nom")
    .single();
  if (error || !data) return { error: error?.message ?? "Création impossible." };
  revalidatePath("/candidatures");
  return { etiquette: data };
}

// Pose (ou retire) une étiquette sur une sélection de candidatures. Elles
// doivent toutes être du projet de l'étiquette.
export async function setEtiquettesBulk(
  candidatureIds: string[],
  etiquetteId: string,
  pose: boolean
): Promise<{ error?: string; n?: number }> {
  if (candidatureIds.length === 0) return { n: 0 };
  const supabase = createAdminClient();
  const { data: etiquette } = await supabase
    .from("candidature_etiquettes")
    .select("projet_id")
    .eq("id", etiquetteId)
    .maybeSingle();
  if (!etiquette) return { error: "Étiquette introuvable." };
  const accessError = await checkProjetAccess(etiquette.projet_id);
  if (accessError) return { error: accessError };

  const { data: candidatures } = await supabase
    .from("candidatures")
    .select("id, annonces!inner(projet_id)")
    .in("id", candidatureIds.slice(0, 300))
    .eq("annonces.projet_id", etiquette.projet_id);
  const ids = (candidatures ?? []).map((c) => c.id);
  if (ids.length === 0) return { error: "Ces candidatures ne sont pas de ce projet." };

  const { error } = pose
    ? await supabase
        .from("candidature_etiquette_liens")
        .upsert(
          ids.map((candidature_id) => ({ candidature_id, etiquette_id: etiquetteId })),
          { onConflict: "candidature_id,etiquette_id", ignoreDuplicates: true }
        )
    : await supabase.from("candidature_etiquette_liens").delete().eq("etiquette_id", etiquetteId).in("candidature_id", ids);
  if (error) return { error: error.message };
  revalidatePath("/candidatures");
  return { n: ids.length };
}

export async function setEtiquette(candidatureId: string, etiquetteId: string, pose: boolean) {
  return setEtiquettesBulk([candidatureId], etiquetteId, pose);
}
