"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";

export type PartageType = "documents" | "essayages" | "casting";

function genToken() {
  return randomUUID().replace(/-/g, "");
}

// Ces liens sont publics (aucune auth requise pour les consulter) — sans
// cette vérification, un·e assistant·e non rattaché·e à un projet pourrait
// en générer un lien de partage quand même et en divulguer le contenu.
async function requireAccessOrThrow(projetId: string) {
  const error = await checkProjetAccess(projetId);
  if (error) throw new Error(error);
}

export async function getPartageToken(projetId: string, type: PartageType) {
  await requireAccessOrThrow(projetId);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partage_liens")
    .select("token")
    .eq("projet_id", projetId)
    .eq("type", type)
    .maybeSingle();
  if (error) throw new Error("Impossible de consulter le lien de partage.");
  return data?.token ?? null;
}

// Titre affiché en haut de la page publique du lien — personnalisable
// (ex. "Casting — LD"), vide si non renseigné (la page retombe alors sur
// son titre générique habituel).
export async function getPartageTitre(projetId: string, type: PartageType) {
  await requireAccessOrThrow(projetId);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partage_liens")
    .select("titre")
    .eq("projet_id", projetId)
    .eq("type", type)
    .maybeSingle();
  if (error) throw new Error("Impossible de consulter le titre du partage.");
  return data?.titre ?? null;
}

export async function updatePartageTitre(projetId: string, type: PartageType, titre: string | null) {
  await requireAccessOrThrow(projetId);

  const supabase = createAdminClient();
  const { error } = await supabase.from("partage_liens")
    .update({ titre }).eq("projet_id", projetId).eq("type", type);
  if (error) throw new Error("Impossible de modifier le titre du partage.");
  revalidatePath("/casting");
}

export async function createPartageLien(projetId: string, type: PartageType) {
  await requireAccessOrThrow(projetId);

  const supabase = createAdminClient();
  const token = genToken();
  const { error } = await supabase.from("partage_liens").upsert(
    { projet_id: projetId, type, token },
    { onConflict: "projet_id,type" }
  );
  if (error) throw new Error("Impossible de créer le lien de partage.");
  revalidatePath("/partage");
  revalidatePath("/essayages");
  return token;
}

// Visibilité des deux documents casting (liste artistique, fiches rôles
// validés) sur le lien réal — indépendante des profils/rôles marqués
// visibles un par un, puisque ces docs résument l'ensemble du casting
// plutôt qu'un profil précis. Sans effet tant qu'aucun lien casting n'a été
// créé (rien à mettre à jour).
export async function updateCastingDocVisible(
  projetId: string,
  doc: "liste_artistique" | "fiches_roles" | "distribution",
  visible: boolean
) {
  await requireAccessOrThrow(projetId);
  // "use server" : TypeScript ne valide pas les arguments désérialisés.
  if (doc !== "liste_artistique" && doc !== "fiches_roles" && doc !== "distribution") {
    throw new Error("Document de casting invalide.");
  }
  if (typeof visible !== "boolean") throw new Error("Visibilité invalide.");

  const supabase = createAdminClient();
  const column =
    doc === "liste_artistique"
      ? "liste_artistique_visible"
      : doc === "fiches_roles"
        ? "fiches_roles_visible"
        : "distribution_visible";
  const { error } = await supabase.from("partage_liens")
    .update({ [column]: visible }).eq("projet_id", projetId).eq("type", "casting");
  if (error) throw new Error("Impossible de modifier la visibilité du document.");
  revalidatePath("/casting");
}

// Masque téléphone/email sur les fiches rôles validés du lien réal, sans
// toucher à la visibilité du document lui-même.
export async function updateFichesRolesMasquerContact(projetId: string, masquer: boolean) {
  await requireAccessOrThrow(projetId);
  if (typeof masquer !== "boolean") throw new Error("Paramètre de confidentialité invalide.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("partage_liens")
    .update({ fiches_roles_masquer_contact: masquer })
    .eq("projet_id", projetId)
    .eq("type", "casting");
  if (error) throw new Error("Impossible de modifier la confidentialité des fiches rôles.");
  revalidatePath("/casting");
}

export async function revokePartageLien(projetId: string, type: PartageType) {
  await requireAccessOrThrow(projetId);

  const supabase = createAdminClient();
  const { error } = await supabase.from("partage_liens")
    .delete().eq("projet_id", projetId).eq("type", type);
  if (error) throw new Error("Impossible de révoquer le lien de partage.");
  revalidatePath("/partage");
  revalidatePath("/essayages");
}

export async function getJourneePartageLien(projetId: string, date: string) {
  await requireAccessOrThrow(projetId);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("partage_journee_liens")
    .select("token, show_contacts")
    .eq("projet_id", projetId)
    .eq("date", date)
    .maybeSingle();
  if (error) throw new Error("Impossible de consulter le lien de journée.");
  return data ? { token: data.token, showContacts: data.show_contacts } : null;
}

export async function createJourneePartageLien(projetId: string, date: string, showContacts: boolean) {
  await requireAccessOrThrow(projetId);

  const supabase = createAdminClient();
  const token = genToken();
  const { error } = await supabase.from("partage_journee_liens").upsert(
    { projet_id: projetId, date, show_contacts: showContacts, token },
    { onConflict: "projet_id,date" }
  );
  if (error) throw new Error("Impossible de créer le lien de partage de journée.");
  revalidatePath("/bookings/documents");
  return token;
}

export async function revokeJourneePartageLien(projetId: string, date: string) {
  await requireAccessOrThrow(projetId);

  const supabase = createAdminClient();
  const { error } = await supabase.from("partage_journee_liens")
    .delete().eq("projet_id", projetId).eq("date", date);
  if (error) throw new Error("Impossible de révoquer le lien de journée.");
  revalidatePath("/bookings/documents");
}
