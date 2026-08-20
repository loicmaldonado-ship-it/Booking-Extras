"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAge } from "@/lib/documents/fields";
import { recordFigurantMessage } from "@/lib/candidats/messaging";
import { activerAccesCompte } from "@/lib/candidats/actions";
import type { Cachet, CandidatureStatut } from "./types";

export async function recordCandidatureMessage(figurantId: string, corps: string, email?: string | null, subject?: string) {
  return recordFigurantMessage({ figurantId, corps, categorie: "libre", email, subject });
}

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

export async function postulerAnnonce(
  publicToken: string,
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const prenom = str(formData, "prenom");
  const nom = str(formData, "nom");
  const email = str(formData, "email");
  const telephone = str(formData, "telephone");
  const ville = str(formData, "ville");
  const dateNaissance = str(formData, "date_naissance");
  const message = str(formData, "message");

  if (!prenom || !nom || !email || !telephone || !ville) {
    return { error: "Tous les champs de contact sont obligatoires." };
  }
  if (!dateNaissance) {
    return { error: "La date de naissance est obligatoire." };
  }
  if (!message) {
    return { error: "Le message est obligatoire." };
  }

  const age = computeAge(dateNaissance);
  if (age === null || age < 0 || age > 120) {
    return { error: "Date de naissance invalide." };
  }

  const supabase = createAdminClient();

  const { data: annonce, error: annonceError } = await supabase
    .from("annonces")
    .select("id, statut, ouverte_mineurs, limite_candidatures")
    .eq("public_token", publicToken)
    .single();

  if (annonceError || !annonce) {
    return { error: "Cette annonce n'existe plus." };
  }
  if (annonce.statut !== "ouverte") {
    return { error: "Cette annonce n'accepte plus de candidatures." };
  }
  if (age < 16 && !annonce.ouverte_mineurs) {
    return { error: "Cette annonce n'est pas ouverte aux candidats de moins de 16 ans." };
  }
  if (annonce.limite_candidatures !== null) {
    const { count } = await supabase
      .from("candidatures")
      .select("id", { count: "exact", head: true })
      .eq("annonce_id", annonce.id);
    if ((count ?? 0) >= annonce.limite_candidatures) {
      return { error: "Cette annonce a atteint son nombre maximum de candidatures." };
    }
  }

  const [{ data: questions }, { data: annonceDates }] = await Promise.all([
    supabase.from("annonce_questions").select("id").eq("annonce_id", annonce.id),
    supabase.from("annonce_dates").select("id").eq("annonce_id", annonce.id),
  ]);

  for (const q of questions ?? []) {
    if (!str(formData, `question_${q.id}`)) {
      return { error: "Merci de répondre à toutes les questions." };
    }
  }
  for (const d of annonceDates ?? []) {
    if (!str(formData, `date_${d.id}`)) {
      return { error: "Merci d'indiquer ta disponibilité pour toutes les dates proposées." };
    }
  }

  const { data: existingFigurant } = await supabase
    .from("figurants")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  let figurantId = existingFigurant?.id as string | undefined;

  // Même sans email identique, on considère que c'est la même personne si
  // le nom et le téléphone correspondent déjà à une fiche existante (1
  // email = 1 fiche, mais une personne ne doit pas se retrouver dupliquée
  // juste parce qu'elle a postulé avec une autre adresse).
  if (!figurantId) {
    const telephoneNormalise = telephone.replace(/\s+/g, "");
    const { data: memeNom } = await supabase.from("figurants").select("id, telephone").ilike("nom", nom);
    const doublon = (memeNom ?? []).find((f) => f.telephone?.replace(/\s+/g, "") === telephoneNormalise);
    if (doublon) figurantId = doublon.id;
  }

  if (!figurantId) {
    const { data: newFigurant, error: figurantError } = await supabase
      .from("figurants")
      .insert({ prenom, nom, email, telephone, ville, date_naissance: dateNaissance })
      .select("id")
      .single();

    if (figurantError) {
      if (figurantError.code === "23505") {
        return { error: "Un profil existe déjà avec cet email. Contactez le casting si besoin." };
      }
      return { error: figurantError.message };
    }
    figurantId = newFigurant.id;
  }

  const { data: candidature, error: candidatureError } = await supabase
    .from("candidatures")
    .insert({
      figurant_id: figurantId,
      annonce_id: annonce.id,
      message,
      date_naissance: dateNaissance,
    })
    .select("id")
    .single();

  if (candidatureError || !candidature) {
    if (candidatureError?.code === "23505") {
      return { error: "Tu as déjà postulé à cette annonce avec cet email." };
    }
    return { error: candidatureError?.message ?? "Erreur inconnue." };
  }

  const reponses = (questions ?? []).map((q) => ({
    candidature_id: candidature.id,
    annonce_question_id: q.id,
    reponse: str(formData, `question_${q.id}`) === "oui",
  }));
  if (reponses.length > 0) await supabase.from("candidature_reponses").insert(reponses);

  const disponibilites = (annonceDates ?? []).map((d) => ({
    candidature_id: candidature.id,
    annonce_date_id: d.id,
    disponible: str(formData, `date_${d.id}`) === "oui",
  }));
  if (disponibilites.length > 0) await supabase.from("candidature_disponibilites").insert(disponibilites);

  await uploadCandidaturePhotos(figurantId!, formData);

  revalidatePath("/candidatures");
  return { success: true };
}

async function uploadCandidaturePhotos(figurantId: string, formData: FormData) {
  const supabase = createAdminClient();
  const { count: existingPhotos } = await supabase
    .from("figurant_photos")
    .select("id", { count: "exact", head: true })
    .eq("figurant_id", figurantId);

  let hasPortrait = (existingPhotos ?? 0) > 0;
  const slots = ["photo_1", "photo_2", "photo_3"];

  for (const slot of slots) {
    const file = formData.get(slot);
    if (!(file instanceof File) || file.size === 0) continue;

    const type = hasPortrait ? "autre" : "portrait";
    hasPortrait = true;

    const ext = file.name.split(".").pop() || "jpg";
    const path = `${figurantId}/${type}-${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("figurant-photos")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) continue;

    await supabase.from("figurant_photos").insert({ figurant_id: figurantId, type, storage_path: path });
  }
}

export async function updateCandidature(id: string, formData: FormData) {
  const statut = str(formData, "statut") as CandidatureStatut | null;
  const fonction_assignee = str(formData, "fonction_assignee");
  const cachet_assigne = str(formData, "cachet_assigne") as Cachet | null;

  if (!statut) return;

  const supabase = createAdminClient();

  const { data: candidature, error } = await supabase
    .from("candidatures")
    .update({ statut, fonction_assignee, cachet_assigne })
    .eq("id", id)
    .select("id, figurant_id, annonce_id")
    .single();

  if (error || !candidature) {
    revalidatePath("/candidatures");
    return;
  }

  if (statut === "retenu") {
    await creerBookingDepuisCandidature(
      candidature.id,
      candidature.figurant_id,
      candidature.annonce_id,
      fonction_assignee,
      cachet_assigne
    );
    await activerAccesCompte(candidature.figurant_id);
  }

  revalidatePath("/candidatures");
}

export async function updateCandidatureStatutInline(id: string, statut: CandidatureStatut) {
  const supabase = createAdminClient();

  const { data: candidature, error } = await supabase
    .from("candidatures")
    .update({ statut })
    .eq("id", id)
    .select("id, figurant_id, annonce_id, fonction_assignee, cachet_assigne")
    .single();

  if (error || !candidature) {
    revalidatePath("/candidatures");
    return { error: error?.message };
  }

  if (statut === "retenu") {
    await creerBookingDepuisCandidature(
      candidature.id,
      candidature.figurant_id,
      candidature.annonce_id,
      candidature.fonction_assignee,
      candidature.cachet_assigne
    );
    await activerAccesCompte(candidature.figurant_id);
  }

  revalidatePath("/candidatures");
  return { success: true };
}

async function creerBookingDepuisCandidature(
  candidatureId: string,
  figurantId: string,
  annonceId: string,
  fonction: string | null,
  cachet: Cachet | null
) {
  const supabase = createAdminClient();

  const { data: existingBooking } = await supabase
    .from("bookings")
    .select("id")
    .eq("candidature_id", candidatureId)
    .maybeSingle();

  if (existingBooking) return;

  const { data: annonce } = await supabase
    .from("annonces")
    .select("projet_id, date_recherchee")
    .eq("id", annonceId)
    .single();

  if (!annonce) return;

  await supabase.from("bookings").insert({
    figurant_id: figurantId,
    projet_id: annonce.projet_id,
    candidature_id: candidatureId,
    date: annonce.date_recherchee ?? new Date().toISOString().slice(0, 10),
    fonction,
    cachet,
  });
}
