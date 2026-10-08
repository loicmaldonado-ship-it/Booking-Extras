"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createFigurantSession } from "@/lib/candidats/session";
import { hashPassword } from "@/lib/candidats/password";
import { lireProfil, emailMasque, MOT_DE_PASSE_MIN } from "@/lib/candidats/profil";
import { insertFigurantPhoto } from "@/lib/figurants/photos";
import { upsertFigurantLienByLabel } from "@/lib/figurants/liens";
import { LIEN_BANDE_DEMO, MAX_PHOTOS_PAR_FIGURANT } from "@/lib/figurants/types";

// Création d'un compte candidat·e sans passer par une annonce (page
// /compte/inscription) : profil complet + photos + mot de passe, puis
// connexion immédiate.
//
// Un email déjà connu n'est JAMAIS rattaché ici : la personne doit d'abord
// prouver que c'est le sien (connexion, ou lien reçu par email) — sinon
// n'importe qui pourrait s'approprier la fiche de quelqu'un d'autre.
export async function inscrireCandidat(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; compteExistant?: boolean }> {
  const lu = lireProfil(formData);
  if ("error" in lu) return { error: lu.error };
  const { profil, age } = lu;
  if (age < 16) {
    return { error: "L'inscription en ligne est réservée aux 16 ans et plus. Pour un·e mineur·e, contacte le casting." };
  }

  const motDePasse = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("password_confirmation") ?? "");
  if (motDePasse.length < MOT_DE_PASSE_MIN) {
    return { error: `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.` };
  }
  if (motDePasse !== confirmation) return { error: "Les deux mots de passe ne sont pas identiques." };

  const photos = {
    portrait: formData.get("photo_portrait"),
    pied: formData.get("photo_pied"),
    selfie: formData.get("photo_selfie"),
  };
  if (!Object.values(photos).every((p) => p instanceof File && p.size > 0)) {
    return { error: "Les 3 photos (portrait, pied, selfie) sont obligatoires." };
  }
  const selfieDate = String(formData.get("selfie_date") ?? "").trim();
  if (!selfieDate) return { error: "La date du selfie est obligatoire." };

  const supabase = createAdminClient();

  // Fiche figurant·e déjà connue (déjà postulé, déjà booké·e) : même email,
  // ou même nom + même téléphone avec une autre adresse.
  const { data: memeEmail } = await supabase
    .from("figurants")
    .select("id")
    .ilike("email", profil.email)
    .eq("est_comedien", false)
    .maybeSingle();
  if (memeEmail) {
    return {
      compteExistant: true,
      error:
        "Tu as déjà un compte avec cet email (tu as sûrement déjà postulé ou été booké·e). Connecte-toi, ou demande un lien de connexion par email si tu n'as pas de mot de passe.",
    };
  }
  const telephoneNormalise = profil.telephone.replace(/\s+/g, "");
  const { data: memeNom } = await supabase
    .from("figurants")
    .select("email, telephone")
    .ilike("nom", profil.nom)
    .eq("est_comedien", false);
  const doublon = (memeNom ?? []).find((f) => f.telephone?.replace(/\s+/g, "") === telephoneNormalise);
  if (doublon) {
    return {
      compteExistant: true,
      error: doublon.email
        ? `Un compte existe déjà à ton nom avec ce numéro, sous l'adresse ${emailMasque(doublon.email)}. Connecte-toi avec cette adresse (ou demande un lien de connexion).`
        : "Un profil existe déjà à ton nom avec ce numéro. Contacte le casting pour le récupérer.",
    };
  }

  const { data: figurant, error } = await supabase
    .from("figurants")
    .insert({ ...profil, acces_compte: true, password_hash: await hashPassword(motDePasse) })
    .select("id")
    .single();
  if (error || !figurant) {
    if (error?.code === "23505") {
      return { compteExistant: true, error: "Tu as déjà un compte avec cet email. Connecte-toi." };
    }
    return { error: error?.message ?? "Création du compte impossible." };
  }

  const lienBandeDemo = String(formData.get("lien_bande_demo") ?? "").trim();
  if (lienBandeDemo) await upsertFigurantLienByLabel(supabase, figurant.id, LIEN_BANDE_DEMO, lienBandeDemo);

  const fichiers: { file: File; type: "portrait" | "pied" | "selfie" | "autre" | "vehicule"; priseLe?: string }[] = [
    { file: photos.portrait as File, type: "portrait" },
    { file: photos.pied as File, type: "pied" },
    { file: photos.selfie as File, type: "selfie", priseLe: selfieDate },
  ];
  const vehicule = formData.get("photo_vehicule");
  if (vehicule instanceof File && vehicule.size > 0) fichiers.push({ file: vehicule, type: "vehicule" });
  for (const extra of formData.getAll("photo_extra")) {
    if (extra instanceof File && extra.size > 0) fichiers.push({ file: extra, type: "autre" });
  }
  for (const { file, type, priseLe } of fichiers.slice(0, MAX_PHOTOS_PAR_FIGURANT)) {
    await insertFigurantPhoto(supabase, figurant.id, type, file, { priseLe });
  }

  await createFigurantSession(figurant.id);
  redirect("/compte?bienvenue=1");
}
