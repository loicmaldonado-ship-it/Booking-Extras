"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto/secrets";
import { motDePasseApp } from "@/lib/projets/email";
import { checkProjetAccess, getCurrentProfile, requireChef } from "@/lib/auth/session";
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
  const profile = await requireChef();

  const payload = buildProjetPayload(formData);
  if (!payload.nom) {
    return { error: "Le nom du projet est obligatoire." };
  }

  const gmailAppPasswordInput = str(formData, "gmail_smtp_app_password");
  const gmailAppPasswordEncrypted =
    payload.gmail_smtp_user && gmailAppPasswordInput ? encryptSecret(motDePasseApp(gmailAppPasswordInput)) : null;
  const gmailError = validateGmailFields(payload.gmail_smtp_user, gmailAppPasswordEncrypted);
  if (gmailError) {
    return { error: gmailError };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("projets")
    .insert({ ...payload, owner_id: profile.id, gmail_smtp_app_password: gmailAppPasswordEncrypted })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  const indemnitesRaw = str(formData, "indemnites");
  let rows: { projet_id: string; label: string; montant: number }[] = [];
  if (indemnitesRaw) {
    try {
      const items = JSON.parse(indemnitesRaw) as { label: string; montant: number }[];
      rows = items
        .filter((it) => it.label?.trim() && Number.isFinite(it.montant))
        .map((it) => ({ projet_id: data.id, label: it.label.trim(), montant: it.montant }));
    } catch {
      // JSON malformé (ne devrait pas arriver, le champ est généré côté client) — on ignore.
    }
  }
  if (rows.length > 0) {
    const { error: indemnitesError } = await supabase.from("projet_indemnites").insert(rows);
    // BUG-13 : le projet existe déjà ; pas de faux succès ni de retour au formulaire de création (risque de doublon) :
    // on ouvre la page de modification avec une alerte.
    if (indemnitesError) {
      revalidatePath("/projets");
      redirect(`/projets/${data.id}/modifier?alerte=indemnites`);
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
    gmailAppPasswordEncrypted = encryptSecret(motDePasseApp(gmailAppPasswordInput));
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

// MET-01 (règle de Loïc, 27/10/2026) : un projet n'est archivé, désarchivé ou supprimé que par la cheffe qui l'a
// créé (ou le compte propriétaire). Avant le 30/10, tout membre du projet (assistante comprise) le pouvait.
// Les actions renvoient { error } au lieu de lever une erreur : en production, Next masque le texte des erreurs levées.
async function erreurCreatriceProjet(id: string): Promise<string | null> {
  const accessError = await checkProjetAccess(id);
  if (accessError) return accessError;
  const profile = await getCurrentProfile();
  if (!profile) return "Non autorisé.";
  if (profile.isOwner) return null;
  const { data, error } = await createAdminClient().from("projets").select("owner_id").eq("id", id).maybeSingle();
  if (error || !data) return "Projet introuvable.";
  if (data.owner_id !== profile.id) return "Seule la cheffe qui a créé ce projet peut l'archiver ou le supprimer.";
  return null;
}

export async function deleteProjet(id: string): Promise<{ error: string }> {
  const refus = await erreurCreatriceProjet(id);
  if (refus) return { error: refus };

  const supabase = createAdminClient();
  const { data: projet } = await supabase.from("projets").select("archive, archive_le").eq("id", id).maybeSingle();
  if (!projet || !projetEstSupprimable(projet)) {
    return { error: "Ce projet doit être archivé depuis au moins 1 an avant de pouvoir être supprimé définitivement." };
  }

  const { data: supprime, error } = await supabase.from("projets").delete().eq("id", id).select("id").maybeSingle();
  if (error || !supprime) return { error: "La suppression du projet a échoué. Rien n'a été supprimé ; réessaie." };
  revalidatePath("/projets");
  redirect("/projets");
}

// Archiver un projet supprime définitivement les profils marqués
// "temporaires" (rôles soi-même — éboueur, chauffeur... — qui ne font de la
// figuration qu'une fois sur ce projet, cochés par le candidat lui-même à
// la candidature). Irréversible : désarchiver ne les restaure pas.
// BUG-13 : l'archivage est enregistré d'abord (vérifié), puis les profils temporaires sont supprimés. Rejouable sur un
// projet déjà archivé pour terminer ce nettoyage (bouton « Supprimer les profils temporaires restants »).
export async function archiverProjet(id: string): Promise<{ error: string }> {
  const refus = await erreurCreatriceProjet(id);
  if (refus) return { error: refus };

  const supabase = createAdminClient();
  const { data: etat, error: etatError } = await supabase.from("projets").select("archive").eq("id", id).maybeSingle();
  if (etatError || !etat) return { error: "Impossible de vérifier le projet. Rien n'a été modifié ; réessaie." };
  if (!etat.archive) {
    const { data: archive, error: archiveError } = await supabase
      .from("projets")
      .update({ archive: true, archive_le: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (archiveError || !archive) return { error: "L'archivage du projet a échoué. Rien n'a été modifié ; réessaie." };
  }

  const reprendre = "Utilise « Supprimer les profils temporaires restants » sur la page du projet pour terminer.";
  const { data: temporaires, error: temporairesError } = await supabase
    .from("figurants")
    .select("id")
    .eq("temporaire_projet_id", id)
    .eq("temporaire", true);
  if (temporairesError) {
    revalidatePath(`/projets/${id}`);
    return { error: `Projet archivé, mais les profils temporaires n'ont pas pu être lus. ${reprendre}` };
  }

  let echecs = 0;
  for (const figurant of temporaires ?? []) {
    const { data: photos, error: photosError } = await supabase
      .from("figurant_photos")
      .select("storage_path")
      .eq("figurant_id", figurant.id);
    if (photosError) { echecs += 1; continue; }
    if (photos && photos.length > 0) {
      await supabase.storage.from("figurant-photos").remove(photos.map((p) => p.storage_path));
    }
    const { error: deleteError } = await supabase.from("figurants").delete().eq("id", figurant.id);
    if (deleteError) echecs += 1;
  }
  if (echecs > 0) {
    revalidatePath("/projets");
    revalidatePath(`/projets/${id}`);
    return { error: `Projet archivé, mais ${echecs} profil(s) temporaire(s) n'ont pas pu être supprimés. ${reprendre}` };
  }

  revalidatePath("/projets");
  revalidatePath(`/projets/${id}`);
  revalidatePath("/figurants");
  redirect(`/projets/${id}`);
}

export async function desarchiverProjet(id: string): Promise<{ error: string }> {
  const refus = await erreurCreatriceProjet(id);
  if (refus) return { error: refus };

  const supabase = createAdminClient();
  const { data: restaure, error } = await supabase.from("projets").update({ archive: false, archive_le: null }).eq("id", id).select("id").maybeSingle();
  if (error || !restaure) return { error: "Le désarchivage du projet a échoué ; réessaie." };

  revalidatePath("/projets");
  revalidatePath(`/projets/${id}`);
  redirect(`/projets/${id}`);
}

export async function countProjetTemporaires(id: string): Promise<number> {
  if (await checkProjetAccess(id)) return 0;
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("figurants")
    .select("id", { count: "exact", head: true })
    .eq("temporaire_projet_id", id)
    .eq("temporaire", true);
  return count ?? 0;
}
