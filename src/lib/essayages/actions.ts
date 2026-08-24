"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordFigurantMessage } from "@/lib/candidats/messaging";
import { checkProjetAccess } from "@/lib/auth/session";
import type { EssayageStatut } from "./types";

// Deux petits helpers pour les fonctions qui ne reçoivent qu'un id
// d'essayage/journée d'essayage plutôt que le projet directement.
async function checkEssayageAccess(essayageId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase.from("essayages").select("projet_id").eq("id", essayageId).maybeSingle();
  if (!data) return null;
  return checkProjetAccess(data.projet_id);
}

async function checkEssayageJourneeAccess(essayageJourneeId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("essayage_journees")
    .select("projet_id")
    .eq("id", essayageJourneeId)
    .maybeSingle();
  if (!data) return null;
  return checkProjetAccess(data.projet_id);
}

// Photo "en tenue" prise pendant l'essayage — rattachée à ce projet
// précisément, elle remplacera le portrait générique sur les trombis et
// fiches mensu de ce projet (voir pickPortrait/pickFichePhotos).
export async function uploadTenuePhoto(figurantId: string, projetId: string, formData: FormData) {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Aucune photo sélectionnée." };

  const supabase = createAdminClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${figurantId}/tenue-${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("figurant-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { error: uploadError.message };

  const { error: insertError } = await supabase
    .from("figurant_photos")
    .insert({ figurant_id: figurantId, type: "tenue", storage_path: path, projet_id: projetId });
  if (insertError) return { error: insertError.message };

  revalidatePath("/essayages/journee");
  revalidatePath("/bookings/documents");
  return { success: true as const };
}

export async function recordEssayageMessage(
  figurantId: string,
  corps: string,
  email?: string | null,
  subject?: string,
  projetId?: string | null
) {
  return recordFigurantMessage({ figurantId, corps, categorie: "essayage", email, subject, projetId });
}

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

function buildEssayagePayload(fd: FormData) {
  return {
    figurant_id: str(fd, "figurant_id") ?? "",
    projet_id: str(fd, "projet_id") ?? "",
    date: str(fd, "date"),
    heure: str(fd, "heure"),
    lieu: str(fd, "lieu"),
    statut: (str(fd, "statut") ?? "proposé") as EssayageStatut,
    notes: str(fd, "notes"),
  };
}

export async function createEssayage(_prevState: unknown, formData: FormData) {
  const payload = buildEssayagePayload(formData);
  if (!payload.figurant_id || !payload.projet_id) {
    return { error: "Figurant et projet sont obligatoires." };
  }
  const accessError = await checkProjetAccess(payload.projet_id);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("essayages")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/essayages");
  redirect(`/essayages/${data.id}`);
}

export async function updateEssayage(id: string, _prevState: unknown, formData: FormData) {
  const payload = buildEssayagePayload(formData);
  if (!payload.figurant_id || !payload.projet_id) {
    return { error: "Figurant et projet sont obligatoires." };
  }
  const accessError = await checkProjetAccess(payload.projet_id);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("essayages").select("projet_id").eq("id", id).maybeSingle();
  if (existing) {
    const existingAccessError = await checkProjetAccess(existing.projet_id);
    if (existingAccessError) return { error: existingAccessError };
  }
  const { error } = await supabase.from("essayages").update(payload).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/essayages");
  revalidatePath(`/essayages/${id}`);
  redirect(`/essayages/${id}`);
}

export async function deleteEssayage(id: string) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from("essayages").select("projet_id").eq("id", id).maybeSingle();
  if (existing) {
    const accessError = await checkProjetAccess(existing.projet_id);
    if (accessError) throw new Error(accessError);
  }
  await supabase.from("essayages").delete().eq("id", id);
  revalidatePath("/essayages");
  redirect("/essayages");
}

export async function createEssayageJournee(projetId: string, formData: FormData) {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) throw new Error(accessError);

  const date = str(formData, "date");
  if (!date) return;

  const supabase = createAdminClient();
  await supabase.from("essayage_journees").upsert({ projet_id: projetId, date }, { onConflict: "projet_id,date" });

  revalidatePath("/essayages");
  redirect(`/essayages/journee?projet_id=${projetId}&date=${date}`);
}

// Recalibrer le lieu (nom + adresse) d'une journée déjà créée, sans
// toucher à sa date — utilisé depuis la première page des essayages.
// Le lieu d'essayage se calibre une fois pour tout le projet — réutilisé
// automatiquement sur toutes ses journées d'essayage (pas à reconfigurer
// date par date). Table dédiée au module essayages, pas de colonne sur
// projets.
export async function updateEssayageLieuProjet(projetId: string, nom: string | null, adresse: string | null) {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("essayage_lieux")
    .upsert({ projet_id: projetId, nom, adresse, updated_at: new Date().toISOString() }, { onConflict: "projet_id" });
  if (error) return { error: error.message };

  revalidatePath("/essayages");
  revalidatePath("/essayages/journee");
  return { success: true as const };
}

// Change le lieu pour une personne précise, indépendamment du reste de la
// journée (ex. cette personne va essayer ailleurs pour X raison).
export async function updateEssayageLieu(id: string, lieu: string | null, adresse: string | null) {
  const accessError = await checkEssayageAccess(id);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  const { error } = await supabase.from("essayages").update({ lieu, adresse }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/essayages/journee");
  return { success: true as const };
}

export async function addFigurantToEssayageJournee(
  essayageJourneeId: string,
  figurantId: string,
  projetId: string,
  date: string,
  lieu: string | null,
  adresse?: string | null
) {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("essayages")
    .select("id")
    .eq("figurant_id", figurantId)
    .eq("projet_id", projetId)
    .eq("date", date)
    .maybeSingle();

  if (existing) return { error: "Ce profil a déjà un essayage ce jour-là sur ce projet." };

  const { error } = await supabase.from("essayages").insert({
    figurant_id: figurantId,
    projet_id: projetId,
    date,
    lieu,
    adresse: adresse ?? null,
    statut: "proposé",
    essayage_journee_id: essayageJourneeId,
  });

  if (error) return { error: error.message };
  revalidatePath("/essayages/journee");
  return { success: true };
}

export async function sendFigurantsToEssayage(
  figurantIds: string[],
  projetId: string,
  date: string,
  lieu: string | null
) {
  if (figurantIds.length === 0) return { error: "Aucun profil sélectionné." };
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();

  const { data: journee, error: journeeError } = await supabase
    .from("essayage_journees")
    .upsert({ projet_id: projetId, date, lieu }, { onConflict: "projet_id,date" })
    .select("id")
    .single();

  if (journeeError || !journee) return { error: journeeError?.message ?? "Erreur inconnue." };

  const { data: existing } = await supabase
    .from("essayages")
    .select("figurant_id")
    .eq("projet_id", projetId)
    .eq("date", date)
    .in("figurant_id", figurantIds);
  const existingIds = new Set((existing ?? []).map((e) => e.figurant_id));

  const toInsert = figurantIds
    .filter((id) => !existingIds.has(id))
    .map((figurant_id) => ({
      figurant_id,
      projet_id: projetId,
      date,
      lieu,
      statut: "proposé" as const,
      essayage_journee_id: journee.id,
    }));

  if (toInsert.length > 0) {
    const { error } = await supabase.from("essayages").insert(toInsert);
    if (error) return { error: error.message };
  }

  revalidatePath("/essayages");
  revalidatePath("/essayages/journee");
  revalidatePath("/bookings/documents");
  return { success: true, added: toInsert.length, skipped: existingIds.size };
}

function costumePrefix(genre: string | null) {
  if (genre === "Homme") return "H";
  if (genre === "Femme") return "F";
  if (genre === "Non-binaire") return "N";
  return null;
}

async function nextNumeroCostume(
  supabase: ReturnType<typeof createAdminClient>,
  projetId: string,
  genre: string | null
) {
  const prefix = costumePrefix(genre);
  if (!prefix) return null;

  const { data } = await supabase
    .from("essayages")
    .select("numero_costume")
    .eq("projet_id", projetId)
    .like("numero_costume", `${prefix}%`);

  const max = (data ?? []).reduce((acc, r) => {
    const n = parseInt((r.numero_costume ?? "").slice(1), 10);
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);

  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

export async function updateEssayageStatutInline(id: string, statut: EssayageStatut) {
  const supabase = createAdminClient();
  const updates: { statut: EssayageStatut; numero_costume?: string } = { statut };

  const { data: essayage } = await supabase
    .from("essayages")
    .select("projet_id, numero_costume, figurant_id")
    .eq("id", id)
    .maybeSingle();
  if (essayage) {
    const accessError = await checkProjetAccess(essayage.projet_id);
    if (accessError) return { error: accessError };
  }

  if (statut === "fait" && essayage && !essayage.numero_costume) {
    const { data: figurant } = await supabase
      .from("figurants")
      .select("genre")
      .eq("id", essayage.figurant_id)
      .single();
    const numero = await nextNumeroCostume(supabase, essayage.projet_id, figurant?.genre ?? null);
    if (numero) updates.numero_costume = numero;
  }

  await supabase.from("essayages").update(updates).eq("id", id);
  revalidatePath("/essayages/journee");
  revalidatePath("/bookings/documents");
  revalidatePath("/figurants");
}

export async function updateEssayageReponseRecue(id: string, reponse_recue: boolean) {
  const accessError = await checkEssayageAccess(id);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  await supabase.from("essayages").update({ reponse_recue }).eq("id", id);
  revalidatePath("/essayages/journee");
}

export async function removeEssayageFromJournee(id: string) {
  const accessError = await checkEssayageAccess(id);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  await supabase.from("essayages").delete().eq("id", id);
  revalidatePath("/essayages/journee");
}

// Déplace des profils d'une journée d'essayage vers une autre (existante ou
// nouvelle) — ex. "je suis le 24, je passe Nina et Paul le 25". Le créneau
// (propre à l'ancienne journée) est réinitialisé ; statut et notes restent.
export async function moveEssayagesToJournee(
  ids: string[],
  projetId: string,
  targetDate: string,
  targetLieu: string | null
) {
  if (ids.length === 0) return { error: "Sélectionne au moins un profil." };
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();

  const { data: existingJournee } = await supabase
    .from("essayage_journees")
    .select("id")
    .eq("projet_id", projetId)
    .eq("date", targetDate)
    .maybeSingle();

  let journeeId = existingJournee?.id;
  if (!journeeId) {
    const { data: created, error: createError } = await supabase
      .from("essayage_journees")
      .insert({ projet_id: projetId, date: targetDate, lieu: targetLieu })
      .select("id")
      .single();
    if (createError || !created) return { error: createError?.message ?? "Impossible de créer la journée cible." };
    journeeId = created.id;
  }

  const { data: toMove } = await supabase.from("essayages").select("id, figurant_id").in("id", ids);
  const { data: dejaPresents } = await supabase
    .from("essayages")
    .select("figurant_id")
    .eq("essayage_journee_id", journeeId);
  const dejaPresentIds = new Set((dejaPresents ?? []).map((e) => e.figurant_id));

  const moveIds = (toMove ?? []).filter((e) => !dejaPresentIds.has(e.figurant_id)).map((e) => e.id);
  const skipped = ids.length - moveIds.length;

  if (moveIds.length > 0) {
    const { error } = await supabase
      .from("essayages")
      .update({ date: targetDate, essayage_journee_id: journeeId, creneau_id: null })
      .in("id", moveIds);
    if (error) return { error: error.message };
  }

  revalidatePath("/essayages");
  revalidatePath("/essayages/journee");
  return { success: true as const, moved: moveIds.length, skipped };
}

export async function addCreneau(essayageJourneeId: string, _prevState: unknown, formData: FormData) {
  const accessError = await checkEssayageJourneeAccess(essayageJourneeId);
  if (accessError) return { error: accessError };

  const heureDebut = str(formData, "heure_debut");
  const heureFin = str(formData, "heure_fin");
  const capacite = Number(str(formData, "capacite") ?? "1");

  if (!heureDebut || !heureFin) return { error: "Heure de début et de fin obligatoires." };
  if (!Number.isFinite(capacite) || capacite < 1) return { error: "Capacité invalide." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("essayage_creneaux").insert({
    essayage_journee_id: essayageJourneeId,
    heure_debut: heureDebut,
    heure_fin: heureFin,
    capacite,
  });

  if (error) return { error: error.message };
  revalidatePath("/essayages/journee");
  return { success: true };
}

export async function generateCreneaux(essayageJourneeId: string, _prevState: unknown, formData: FormData) {
  const accessError = await checkEssayageJourneeAccess(essayageJourneeId);
  if (accessError) return { error: accessError };

  const heureDebut = str(formData, "heure_debut");
  const heureFin = str(formData, "heure_fin");
  const dureeMinutes = Number(str(formData, "duree_minutes") ?? "60");
  const capacite = Number(str(formData, "capacite") ?? "3");

  if (!heureDebut || !heureFin) return { error: "Heure de début et de fin de journée obligatoires." };
  if (!Number.isFinite(dureeMinutes) || dureeMinutes < 5) return { error: "Durée par créneau invalide." };
  if (!Number.isFinite(capacite) || capacite < 1) return { error: "Capacité invalide." };

  const [startH, startM] = heureDebut.split(":").map(Number);
  const [endH, endM] = heureFin.split(":").map(Number);
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  if (!Number.isFinite(startTotal) || !Number.isFinite(endTotal) || endTotal <= startTotal) {
    return { error: "L'heure de fin doit être après l'heure de début." };
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("essayage_creneaux")
    .select("heure_debut")
    .eq("essayage_journee_id", essayageJourneeId);
  const existingSet = new Set((existing ?? []).map((c) => c.heure_debut.slice(0, 5)));

  function toHHMM(totalMinutes: number) {
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }

  const toInsert: { essayage_journee_id: string; heure_debut: string; heure_fin: string; capacite: number }[] = [];
  for (let t = startTotal; t + dureeMinutes <= endTotal; t += dureeMinutes) {
    const debut = toHHMM(t);
    if (existingSet.has(debut)) continue;
    toInsert.push({
      essayage_journee_id: essayageJourneeId,
      heure_debut: debut,
      heure_fin: toHHMM(t + dureeMinutes),
      capacite,
    });
  }

  if (toInsert.length === 0) {
    return { error: "Aucun nouveau créneau à créer (déjà existants ou plage horaire vide)." };
  }

  const { error } = await supabase.from("essayage_creneaux").insert(toInsert);
  if (error) return { error: error.message };

  revalidatePath("/essayages/journee");
  revalidatePath("/partage/essayages");
  return { success: true, count: toInsert.length };
}

export async function removeCreneau(creneauId: string) {
  const supabase = createAdminClient();
  const { data: creneau } = await supabase
    .from("essayage_creneaux")
    .select("essayage_journee_id")
    .eq("id", creneauId)
    .maybeSingle();
  if (creneau) {
    const accessError = await checkEssayageJourneeAccess(creneau.essayage_journee_id);
    if (accessError) throw new Error(accessError);
  }
  await supabase.from("essayages").update({ creneau_id: null }).eq("creneau_id", creneauId);
  await supabase.from("essayage_creneaux").delete().eq("id", creneauId);
  revalidatePath("/essayages/journee");
}

export async function assignFigurantToCreneau(essayageId: string, creneauId: string | null) {
  const accessError = await checkEssayageAccess(essayageId);
  if (accessError) return { error: accessError };

  const supabase = createAdminClient();
  await supabase.from("essayages").update({ creneau_id: creneauId }).eq("id", essayageId);
  revalidatePath("/essayages/journee");
  revalidatePath("/partage/essayages");
}
