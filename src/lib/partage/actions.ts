"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess } from "@/lib/auth/session";
import { COLONNES_OPTIONS_REEL, type OptionsReel } from "@/lib/partage/data";
import type { CategorieCachet } from "@/lib/casting/types";

export type PartageType = "documents" | "essayages" | "casting";

// Un lien casting couvre tout le casting (categorie null) ou une seule
// catégorie (rôles, silhouettes, doublures) ; les autres types n'en ont pas.
export type CategorieLien = CategorieCachet | null;

// Restreint une requête sur partage_liens à la catégorie voulue.
function dansCategorie<T>(q: T, categorie: CategorieLien): T {
  const f = q as unknown as { eq: (c: string, v: string) => unknown; is: (c: string, v: null) => unknown };
  return (categorie ? f.eq("categorie", categorie) : f.is("categorie", null)) as T;
}

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

export async function getPartageToken(projetId: string, type: PartageType, categorie: CategorieLien = null) {
  const supabase = createAdminClient();
  const { data } = await dansCategorie(
    supabase.from("partage_liens").select("token").eq("projet_id", projetId).eq("type", type),
    categorie
  ).maybeSingle();
  return data?.token ?? null;
}

// Titre affiché en haut de la page publique du lien — personnalisable
// (ex. "Casting — LD"), vide si non renseigné (la page retombe alors sur
// son titre générique habituel).
export async function getPartageTitre(projetId: string, type: PartageType, categorie: CategorieLien = null) {
  const supabase = createAdminClient();
  const { data } = await dansCategorie(
    supabase.from("partage_liens").select("titre").eq("projet_id", projetId).eq("type", type),
    categorie
  ).maybeSingle();
  return data?.titre ?? null;
}

export async function updatePartageTitre(projetId: string, type: PartageType, titre: string | null, categorie: CategorieLien = null) {
  await requireAccessOrThrow(projetId);

  const supabase = createAdminClient();
  await dansCategorie(supabase.from("partage_liens").update({ titre }).eq("projet_id", projetId).eq("type", type), categorie);
  revalidatePath("/casting");
}

// Crée le lien, ou le régénère (nouveau jeton) s'il existe déjà.
export async function createPartageLien(projetId: string, type: PartageType, categorie: CategorieLien = null) {
  await requireAccessOrThrow(projetId);

  const supabase = createAdminClient();
  const token = genToken();
  const { data: existant } = await dansCategorie(
    supabase.from("partage_liens").select("id").eq("projet_id", projetId).eq("type", type),
    categorie
  ).maybeSingle();
  if (existant) await supabase.from("partage_liens").update({ token }).eq("id", existant.id);
  else await supabase.from("partage_liens").insert({ projet_id: projetId, type, token, categorie });
  revalidatePath("/partage");
  revalidatePath("/essayages");
  revalidatePath("/casting");
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
  visible: boolean,
  categorie: CategorieLien = null
) {
  await requireAccessOrThrow(projetId);

  const supabase = createAdminClient();
  const column =
    doc === "liste_artistique"
      ? "liste_artistique_visible"
      : doc === "fiches_roles"
        ? "fiches_roles_visible"
        : "distribution_visible";
  await dansCategorie(supabase.from("partage_liens").update({ [column]: visible }).eq("projet_id", projetId).eq("type", "casting"), categorie);
  revalidatePath("/casting");
}

// Masque téléphone/email sur les fiches rôles validés du lien réal, sans
// toucher à la visibilité du document lui-même.
export async function updateFichesRolesMasquerContact(projetId: string, masquer: boolean, categorie: CategorieLien = null) {
  await requireAccessOrThrow(projetId);

  const supabase = createAdminClient();
  await dansCategorie(
    supabase.from("partage_liens").update({ fiches_roles_masquer_contact: masquer }).eq("projet_id", projetId).eq("type", "casting"),
    categorie
  );
  revalidatePath("/casting");
}

export async function revokePartageLien(projetId: string, type: PartageType, categorie: CategorieLien = null) {
  await requireAccessOrThrow(projetId);

  const supabase = createAdminClient();
  await dansCategorie(supabase.from("partage_liens").delete().eq("projet_id", projetId).eq("type", type), categorie);
  revalidatePath("/partage");
  revalidatePath("/essayages");
}

export async function getJourneePartageLien(projetId: string, date: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("partage_journee_liens")
    .select("token, show_contacts")
    .eq("projet_id", projetId)
    .eq("date", date)
    .maybeSingle();
  return data ? { token: data.token, showContacts: data.show_contacts } : null;
}

export async function createJourneePartageLien(projetId: string, date: string, showContacts: boolean) {
  await requireAccessOrThrow(projetId);

  const supabase = createAdminClient();
  const token = genToken();
  await supabase.from("partage_journee_liens").upsert(
    { projet_id: projetId, date, show_contacts: showContacts, token },
    { onConflict: "projet_id,date" }
  );
  revalidatePath("/bookings/documents");
  return token;
}

export async function revokeJourneePartageLien(projetId: string, date: string) {
  await requireAccessOrThrow(projetId);

  const supabase = createAdminClient();
  await supabase.from("partage_journee_liens").delete().eq("projet_id", projetId).eq("date", date);
  revalidatePath("/bookings/documents");
}

// Réglage du lien réal du casting : ce qui est montré au·à la réal (âge,
// ville, taille, autres mensurations, réponses aux questions) et ce qu'il·elle
// peut faire (avis Oui / Peut-être / Non, commentaires par profil).
export async function updateReelOption(projetId: string, cle: keyof OptionsReel, valeur: boolean, categorie: CategorieLien = null) {
  await requireAccessOrThrow(projetId);
  const colonne = COLONNES_OPTIONS_REEL[cle];
  if (!colonne) return;
  await dansCategorie(
    createAdminClient().from("partage_liens").update({ [colonne]: valeur }).eq("projet_id", projetId).eq("type", "casting"),
    categorie
  );
  revalidatePath("/casting");
}
