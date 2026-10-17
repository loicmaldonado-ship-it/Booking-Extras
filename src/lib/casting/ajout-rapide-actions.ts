"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
import { comedienPoolIdFor } from "@/lib/figurants/comedien-privacy";
import { insertFigurantPhoto } from "@/lib/figurants/photos";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Ajout rapide dans un rôle : photo, prénom, nom, email, téléphone. La
// fiche va dans la base casting privée de la cheffe (pool comédien·nes /
// casting) et rejoint le rôle ; la personne complétera sa fiche
// (naissance, mensurations…) en envoyant ses photos / vidéos avec son lien.
export async function ajoutRapideCasting(
  roleId: string,
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean; nom?: string }> {
  const supabase = createAdminClient();
  const { data: role } = await supabase.from("casting_roles").select("projet_id, mode").eq("id", roleId).maybeSingle();
  if (!role) return { error: "Rôle introuvable." };
  const accessError = await checkProjetAccess(role.projet_id);
  if (accessError) return { error: accessError };

  const champ = (k: string) => String(formData.get(k) ?? "").trim();
  const prenom = champ("prenom");
  const nom = champ("nom");
  const email = champ("email").toLowerCase();
  const telephone = champ("telephone");
  const photo = formData.get("photo");
  if (!prenom || !nom) return { error: "Prénom et nom obligatoires." };
  if (email && !EMAIL_RE.test(email)) return { error: "Adresse email invalide." };
  if (!email && !telephone) return { error: "Indique au moins un email ou un téléphone pour pouvoir le·la contacter." };

  const poolId = comedienPoolIdFor(await getCurrentProfile());

  // Déjà dans la base casting (même email) : on reprend la fiche.
  let figurantId: string | null = null;
  if (email) {
    let q = supabase
      .from("figurants")
      .select("id")
      .eq("est_comedien", true)
      .ilike("email", email.replace(/[\\%_]/g, "\\$&"));
    q = poolId ? q.eq("comedien_pool_id", poolId) : q.is("comedien_pool_id", null);
    const { data: existante } = await q.maybeSingle();
    figurantId = existante?.id ?? null;
  }
  if (!figurantId) {
    const { data: creee, error } = await supabase
      .from("figurants")
      .insert({
        prenom,
        nom,
        email: email || null,
        telephone: telephone || null,
        est_comedien: true,
        comedien_pool_id: poolId,
        confirme: true,
        cree_via_casting: true,
      })
      .select("id")
      .single();
    if (error || !creee) return { error: error?.message ?? "Création du profil impossible." };
    figurantId = creee.id;
  }

  if (photo instanceof File && photo.size > 0) {
    const res = await insertFigurantPhoto(supabase, figurantId!, "portrait", photo);
    if (res.error) return { error: `Profil créé, mais la photo n'a pas pu être enregistrée : ${res.error}` };
  }

  const { data: entree } = await supabase
    .from("casting_entries")
    .select("id")
    .eq("role_id", roleId)
    .eq("figurant_id", figurantId)
    .maybeSingle();
  if (!entree) {
    const { error } = await supabase
      .from("casting_entries")
      .insert({ projet_id: role.projet_id, role_id: roleId, figurant_id: figurantId, mode: role.mode });
    if (error) return { error: error.message };
  }

  revalidatePath("/casting");
  return { success: true, nom: `${prenom} ${nom}` };
}
