"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto/secrets";
import { checkProjetAccess, requireChef } from "@/lib/auth/session";
import { projetEstSupprimable } from "./types";
import type { Convention, ProjetType } from "./types";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

function num(fd: FormData, key: string, fallback: number): number {
  const v = str(fd, key);
  if (v === null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function buildProjetPayload(fd: FormData) {
  return {
    nom: str(fd, "nom") ?? "",
    type: str(fd, "type") as ProjetType | null,
    convention: str(fd, "convention") as Convention | null,
    realisateur: str(fd, "realisateur"),
    societe_production: str(fd, "societe_production"),
    diffuseur: str(fd, "diffuseur"),
    confidentiel: fd.get("confidentiel") === "on",
    nom_code: str(fd, "nom_code"),
    date_debut: str(fd, "date_debut"),
    date_fin: str(fd, "date_fin"),
    lieu: str(fd, "lieu"),
    contact_nom: str(fd, "contact_nom"),
    contact_telephone: str(fd, "contact_telephone"),
    contact_email: str(fd, "contact_email"),
    besoins_figuration: str(fd, "besoins_figuration"),
    synopsis: str(fd, "synopsis"),
    signature: str(fd, "signature"),
    gmail_smtp_user: str(fd, "gmail_smtp_user"),
    covoiturage_tarif_base: num(fd, "covoiturage_tarif_base", 15),
    covoiturage_tarif_passager: num(fd, "covoiturage_tarif_passager", 5),
  };
}

function validateGmailFields(gmailUser: string | null, gmailAppPasswordEncrypted: string | null) {
  if (!!gmailUser !== !!gmailAppPasswordEncrypted) {
    return "Renseigne l'adresse Gmail ET le mot de passe d'application, ou laisse les deux champs vides.";
  }
  return null;
}

export async function createProjet(_prevState: unknown, formData: FormData) {
  await requireChef();

  const payload = buildProjetPayload(formData);
  if (!payload.nom) {
    return { error: "Le nom du projet est obligatoire." };
  }

  const gmailAppPasswordInput = str(formData, "gmail_smtp_app_password");
  const gmailAppPasswordEncrypted =
    payload.gmail_smtp_user && gmailAppPasswordInput ? encryptSecret(gmailAppPasswordInput) : null;
  const gmailError = validateGmailFields(payload.gmail_smtp_user, gmailAppPasswordEncrypted);
  if (gmailError) {
    return { error: gmailError };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("projets")
    .insert({ ...payload, gmail_smtp_app_password: gmailAppPasswordEncrypted })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  const indemnitesRaw = str(formData, "indemnites");
  if (indemnitesRaw) {
    try {
      const items = JSON.parse(indemnitesRaw) as { label: string; montant: number }[];
      const rows = items
        .filter((it) => it.label?.trim() && Number.isFinite(it.montant))
        .map((it) => ({ projet_id: data.id, label: it.label.trim(), montant: it.montant }));
      if (rows.length > 0) await supabase.from("projet_indemnites").insert(rows);
    } catch {
      // JSON malformé (ne devrait pas arriver, le champ est généré côté client) — on ignore.
    }
  }

  revalidatePath("/projets");
  redirect(`/projets/${data.id}`);
}

export async function updateProjet(
  id: string,
  _prevState: unknown,
  formData: FormData
) {
  const accessError = await checkProjetAccess(id);
  if (accessError) return { error: accessError };

  const payload = buildProjetPayload(formData);
  if (!payload.nom) {
    return { error: "Le nom du projet est obligatoire." };
  }

  const supabase = createAdminClient();
  const gmailAppPasswordInput = str(formData, "gmail_smtp_app_password");

  // Le champ mot de passe n'affiche jamais la valeur enregistrée (elle est
  // chiffrée) : le laisser vide signifie "ne pas y toucher", sauf si
  // l'adresse Gmail elle-même a été effacée, auquel cas on supprime toute
  // la config (email + mot de passe) plutôt que de garder un mot de passe
  // orphelin.
  let gmailAppPasswordEncrypted: string | null;
  if (!payload.gmail_smtp_user) {
    gmailAppPasswordEncrypted = null;
  } else if (gmailAppPasswordInput) {
    gmailAppPasswordEncrypted = encryptSecret(gmailAppPasswordInput);
  } else {
    const { data: existing } = await supabase
      .from("projets")
      .select("gmail_smtp_app_password")
      .eq("id", id)
      .maybeSingle();
    gmailAppPasswordEncrypted = existing?.gmail_smtp_app_password ?? null;
  }

  const gmailError = validateGmailFields(payload.gmail_smtp_user, gmailAppPasswordEncrypted);
  if (gmailError) {
    return { error: gmailError };
  }

  const { error } = await supabase
    .from("projets")
    .update({ ...payload, gmail_smtp_app_password: gmailAppPasswordEncrypted })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/projets");
  revalidatePath(`/projets/${id}`);
  redirect(`/projets/${id}`);
}

export async function deleteProjet(id: string) {
  await requireChef();

  const supabase = createAdminClient();
  const { data: projet } = await supabase.from("projets").select("archive, archive_le").eq("id", id).maybeSingle();
  if (!projet || !projetEstSupprimable(projet)) {
    throw new Error("Ce projet doit être archivé depuis au moins 1 an avant de pouvoir être supprimé définitivement.");
  }

  await supabase.from("projets").delete().eq("id", id);
  revalidatePath("/projets");
  redirect("/projets");
}

// Archiver un projet supprime définitivement les profils marqués
// "temporaires" (rôles soi-même — éboueur, chauffeur... — qui ne font de la
// figuration qu'une fois sur ce projet, cochés par le candidat lui-même à
// la candidature). Irréversible : désarchiver ne les restaure pas.
export async function archiverProjet(id: string) {
  await requireChef();

  const supabase = createAdminClient();

  const { data: temporaires } = await supabase
    .from("figurants")
    .select("id")
    .eq("temporaire_projet_id", id)
    .eq("temporaire", true);

  for (const figurant of temporaires ?? []) {
    const { data: photos } = await supabase
      .from("figurant_photos")
      .select("storage_path")
      .eq("figurant_id", figurant.id);
    if (photos && photos.length > 0) {
      await supabase.storage.from("figurant-photos").remove(photos.map((p) => p.storage_path));
    }
    await supabase.from("figurants").delete().eq("id", figurant.id);
  }

  await supabase.from("projets").update({ archive: true, archive_le: new Date().toISOString() }).eq("id", id);

  revalidatePath("/projets");
  revalidatePath(`/projets/${id}`);
  revalidatePath("/figurants");
  redirect(`/projets/${id}`);
}

export async function desarchiverProjet(id: string) {
  await requireChef();

  const supabase = createAdminClient();
  await supabase.from("projets").update({ archive: false, archive_le: null }).eq("id", id);

  revalidatePath("/projets");
  revalidatePath(`/projets/${id}`);
  redirect(`/projets/${id}`);
}

export async function countProjetTemporaires(id: string): Promise<number> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("figurants")
    .select("id", { count: "exact", head: true })
    .eq("temporaire_projet_id", id)
    .eq("temporaire", true);
  return count ?? 0;
}
