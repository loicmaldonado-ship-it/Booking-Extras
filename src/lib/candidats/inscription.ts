"use server";

import { readGuardians } from "@/lib/minors/model";
import { saveGuardiansFromForm } from "@/lib/minors/data";
import { retourAutorise } from "@/lib/candidats/retour";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createFigurantSession } from "@/lib/candidats/session";
import { definirMotDePasse } from "@/lib/candidats/mot-de-passe";
import { invitationPourFicheSansCompte } from "@/lib/candidats/invitation";
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
): Promise<{ error?: string; compteExistant?: boolean; invitationEnvoyee?: boolean }> {
  const lu = lireProfil(formData);
  if ("error" in lu) return { error: lu.error };
  const { profil } = lu;
  const guardians = readGuardians(formData, profil.date_naissance, profil.email);
  if ("error" in guardians) return guardians;

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
  const retour = retourAutorise(formData.get("retour"));
  if (memeEmail) {
    // Fiche ajoutée par l'équipe, sans compte : lien « Crée ton compte ».
    const invitation = await invitationPourFicheSansCompte(memeEmail.id, null, retour);
    if (invitation) return invitation;
    return {
      compteExistant: true,
      error:
        "Tu as déjà un compte avec cet email (tu as sûrement déjà postulé ou été booké·e). Connecte-toi, ou demande un lien de connexion par email si tu n'as pas de mot de passe.",
    };
  }
  const telephoneNormalise = profil.telephone.replace(/\s+/g, "");
  const { data: memeNom } = await supabase
    .from("figurants")
    .select("id, email, telephone")
    .ilike("nom", profil.nom)
    .eq("est_comedien", false);
  const doublon = (memeNom ?? []).find((f) => f.telephone?.replace(/\s+/g, "") === telephoneNormalise);
  if (doublon) {
    const invitation = doublon.email ? await invitationPourFicheSansCompte(doublon.id, null, retour) : null;
    if (invitation) return invitation;
    return {
      compteExistant: true,
      error: doublon.email
        ? `Un compte existe déjà à ton nom avec ce numéro, sous l'adresse ${emailMasque(doublon.email)}. Connecte-toi avec cette adresse (ou demande un lien de connexion).`
        : "Un profil existe déjà à ton nom avec ce numéro. Contacte le casting pour le récupérer.",
    };
  }

  const { data: figurant, error } = await supabase
    .from("figurants")
    .insert({ ...profil, acces_compte: true })
    .select("id")
    .single();
  if (error || !figurant) {
    if (error?.code === "23505") {
      return { compteExistant: true, error: "Tu as déjà un compte avec cet email. Connecte-toi." };
    }
    return { error: error?.message ?? "Création du compte impossible." };
  }
  const legal = await saveGuardiansFromForm(figurant.id, formData, profil.date_naissance, profil.email);
  if (legal.error) {
    await supabase.from("figurants").delete().eq("id", figurant.id);
    return legal;
  }
  const mdp = await definirMotDePasse(figurant.id, motDePasse);
  if (mdp.error) {
    await supabase.from("figurants").delete().eq("id", figurant.id);
    return { error: "Création du compte impossible, réessaie." };
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
    const photo = await insertFigurantPhoto(supabase, figurant.id, type, file, { priseLe });
    if (photo.error) {
      return { compteExistant: true, error: "Ton compte a été créé, mais une photo n’a pas pu être enregistrée. Connecte-toi avec ton mot de passe pour compléter tes photos." };
    }
  }

  await createFigurantSession(figurant.id);
  // Compte créé depuis un lien rapide de casting : on y retourne directement.
  redirect(retour ?? "/compte?bienvenue=1");
}
