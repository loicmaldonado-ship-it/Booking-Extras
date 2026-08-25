"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto/secrets";
import { getCurrentProfile } from "@/lib/auth/session";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

// Boîte Gmail par défaut de la cheffe — utilisée pour tous ses projets qui
// n'ont pas leur propre adresse configurée (voir getProjetEmailCredentials).
export async function updateMyGmailSmtp(_prevState: unknown, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "chef") return { error: "Réservé au·à la chef·fe." };

  const supabase = createAdminClient();

  const gmailUser = str(formData, "gmail_smtp_user");
  const gmailAppPasswordInput = str(formData, "gmail_smtp_app_password");

  // Le champ mot de passe n'affiche jamais la valeur enregistrée (elle est
  // chiffrée) : le laisser vide signifie "ne pas y toucher", sauf si
  // l'adresse Gmail elle-même a été effacée, auquel cas on supprime toute
  // la config plutôt que de garder un mot de passe orphelin.
  let gmailAppPasswordEncrypted: string | null;
  if (!gmailUser) {
    gmailAppPasswordEncrypted = null;
  } else if (gmailAppPasswordInput) {
    gmailAppPasswordEncrypted = encryptSecret(gmailAppPasswordInput);
  } else {
    const { data: existing } = await supabase
      .from("profiles")
      .select("gmail_smtp_app_password")
      .eq("id", profile.id)
      .maybeSingle();
    gmailAppPasswordEncrypted = existing?.gmail_smtp_app_password ?? null;
  }

  if (!!gmailUser !== !!gmailAppPasswordEncrypted) {
    return { error: "Renseigne l'adresse Gmail ET le mot de passe d'application, ou laisse les deux champs vides." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ gmail_smtp_user: gmailUser, gmail_smtp_app_password: gmailAppPasswordEncrypted })
    .eq("id", profile.id);
  if (error) return { error: error.message };

  revalidatePath("/equipe");
  return { success: true as const };
}
