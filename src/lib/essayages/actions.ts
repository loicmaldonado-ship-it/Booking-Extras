"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordFigurantMessage } from "@/lib/candidats/messaging";
import type { EssayageStatut } from "./types";

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

  const supabase = createAdminClient();
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
  await supabase.from("essayages").delete().eq("id", id);
  revalidatePath("/essayages");
  redirect("/essayages");
}

export async function createEssayageJournee(projetId: string, formData: FormData) {
  const date = str(formData, "date");
  const lieu = str(formData, "lieu");
  if (!date) return;

  const supabase = createAdminClient();
  await supabase
    .from("essayage_journees")
    .upsert({ projet_id: projetId, date, lieu }, { onConflict: "projet_id,date" });

  revalidatePath("/essayages");
  redirect(`/essayages/journee?projet_id=${projetId}&date=${date}`);
}

export async function addFigurantToEssayageJournee(
  essayageJourneeId: string,
  figurantId: string,
  projetId: string,
  date: string,
  lieu: string | null
) {
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

  if (statut === "fait") {
    const { data: essayage } = await supabase
      .from("essayages")
      .select("projet_id, numero_costume, figurant_id")
      .eq("id", id)
      .single();

    if (essayage && !essayage.numero_costume) {
      const { data: figurant } = await supabase
        .from("figurants")
        .select("genre")
        .eq("id", essayage.figurant_id)
        .single();
      const numero = await nextNumeroCostume(supabase, essayage.projet_id, figurant?.genre ?? null);
      if (numero) updates.numero_costume = numero;
    }
  }

  await supabase.from("essayages").update(updates).eq("id", id);
  revalidatePath("/essayages/journee");
  revalidatePath("/bookings/documents");
  revalidatePath("/figurants");
}

export async function updateEssayageReponseRecue(id: string, reponse_recue: boolean) {
  const supabase = createAdminClient();
  await supabase.from("essayages").update({ reponse_recue }).eq("id", id);
  revalidatePath("/essayages/journee");
}

export async function removeEssayageFromJournee(id: string) {
  const supabase = createAdminClient();
  await supabase.from("essayages").delete().eq("id", id);
  revalidatePath("/essayages/journee");
}

export async function addCreneau(essayageJourneeId: string, _prevState: unknown, formData: FormData) {
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
  await supabase.from("essayages").update({ creneau_id: null }).eq("creneau_id", creneauId);
  await supabase.from("essayage_creneaux").delete().eq("id", creneauId);
  revalidatePath("/essayages/journee");
}

export async function assignFigurantToCreneau(essayageId: string, creneauId: string | null) {
  const supabase = createAdminClient();
  await supabase.from("essayages").update({ creneau_id: creneauId }).eq("id", essayageId);
  revalidatePath("/essayages/journee");
  revalidatePath("/partage/essayages");
}
