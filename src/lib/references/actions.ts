"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { isOwner } from "@/lib/auth/owner";
import { REFERENCE_TYPES, type ReferenceType } from "./types";

// Le bucket est déclaré ici aussi : data.ts est « server-only » mais pas un
// fichier d'actions.
const BUCKET = "references-affiches";

async function exigerProprietaire(): Promise<string | null> {
  const profile = await getCurrentProfile();
  return isOwner(profile) ? null : "Réservé au compte propriétaire.";
}

function revalider() {
  revalidatePath("/admin/references");
  revalidatePath("/");
}

function lireChamps(fd: FormData): { titre: string; type: ReferenceType; annee: number | null; realisation: string | null } | { error: string } {
  const titre = String(fd.get("titre") ?? "").trim();
  if (!titre) return { error: "Le titre est obligatoire." };
  const typeBrut = String(fd.get("type") ?? "film");
  const type = (REFERENCE_TYPES.some((t) => t.value === typeBrut) ? typeBrut : "film") as ReferenceType;
  const anneeBrute = String(fd.get("annee") ?? "").trim();
  const annee = anneeBrute ? Number(anneeBrute) : null;
  if (annee !== null && (!Number.isInteger(annee) || annee < 1950 || annee > 2100)) {
    return { error: "Année invalide." };
  }
  const realisation = String(fd.get("realisation") ?? "").trim() || null;
  return { titre, type, annee, realisation };
}

async function envoyerAffiche(fichier: FormDataEntryValue | null): Promise<{ path?: string; error?: string }> {
  if (!(fichier instanceof File) || fichier.size === 0) return {};
  if (!["image/jpeg", "image/png", "image/webp"].includes(fichier.type)) {
    return { error: "L'affiche doit être une image JPEG, PNG ou WebP." };
  }
  if (fichier.size > 4 * 1024 * 1024) return { error: "Affiche trop lourde (4 Mo maximum)." };
  const ext = fichier.type === "image/png" ? "png" : fichier.type === "image/webp" ? "webp" : "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await createAdminClient().storage.from(BUCKET).upload(path, fichier, { contentType: fichier.type });
  return error ? { error: error.message } : { path };
}

export async function ajouterReference(_prev: unknown, fd: FormData): Promise<{ error?: string; success?: boolean }> {
  const refus = await exigerProprietaire();
  if (refus) return { error: refus };
  const champs = lireChamps(fd);
  if ("error" in champs) return champs;
  const affiche = await envoyerAffiche(fd.get("affiche"));
  if (affiche.error) return { error: affiche.error };

  const supabase = createAdminClient();
  const { data: dernier } = await supabase
    .from("references_accueil")
    .select("ordre")
    .order("ordre", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("references_accueil")
    .insert({ ...champs, affiche_storage_path: affiche.path ?? null, ordre: (dernier?.ordre ?? 0) + 1 });
  if (error) return { error: error.message };
  revalider();
  return { success: true };
}

export async function modifierReference(
  id: string,
  _prev: unknown,
  fd: FormData
): Promise<{ error?: string; success?: boolean }> {
  const refus = await exigerProprietaire();
  if (refus) return { error: refus };
  const champs = lireChamps(fd);
  if ("error" in champs) return champs;
  const affiche = await envoyerAffiche(fd.get("affiche"));
  if (affiche.error) return { error: affiche.error };

  const supabase = createAdminClient();
  const { data: avant } = await supabase.from("references_accueil").select("affiche_storage_path").eq("id", id).maybeSingle();
  const { error } = await supabase
    .from("references_accueil")
    .update({ ...champs, ...(affiche.path ? { affiche_storage_path: affiche.path } : {}) })
    .eq("id", id);
  if (error) return { error: error.message };
  if (affiche.path && avant?.affiche_storage_path) {
    await supabase.storage.from(BUCKET).remove([avant.affiche_storage_path]);
  }
  revalider();
  return { success: true };
}

export async function basculerReferenceVisible(id: string, visible: boolean) {
  if (await exigerProprietaire()) return;
  await createAdminClient().from("references_accueil").update({ visible }).eq("id", id);
  revalider();
}

export async function supprimerReference(id: string) {
  if (await exigerProprietaire()) return;
  const supabase = createAdminClient();
  const { data } = await supabase.from("references_accueil").select("affiche_storage_path").eq("id", id).maybeSingle();
  await supabase.from("references_accueil").delete().eq("id", id);
  if (data?.affiche_storage_path) await supabase.storage.from(BUCKET).remove([data.affiche_storage_path]);
  revalider();
}

// Échange la place de la référence avec sa voisine (« monter » / « descendre »).
export async function deplacerReference(id: string, sens: "haut" | "bas") {
  if (await exigerProprietaire()) return;
  const supabase = createAdminClient();
  const { data: toutes } = await supabase.from("references_accueil").select("id, ordre").order("ordre").order("created_at");
  const liste = toutes ?? [];
  const i = liste.findIndex((r) => r.id === id);
  const j = sens === "haut" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= liste.length) return;
  [liste[i], liste[j]] = [liste[j], liste[i]];
  // Renumérote tout : des ordres égaux (ajouts anciens) se départagent ainsi.
  await Promise.all(liste.map((r, k) => supabase.from("references_accueil").update({ ordre: k + 1 }).eq("id", r.id)));
  revalider();
}
