"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
import { getProjetEmailCredentials, getOwnerEmailCredentials } from "@/lib/projets/email";
import { verifierBoiteEnvoi } from "@/lib/email/send";

export type ResultatTestBoite = { ok: boolean; message: string };

// Bouton « Tester la boîte d'envoi » : se connecte à Gmail avec la config
// enregistrée (projet, sinon boîte de la cheffe) sans rien envoyer, et
// renvoie la réponse de Gmail telle quelle en cas de refus.
export async function testerBoiteEnvoiProjet(projetId: string): Promise<ResultatTestBoite> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { ok: false, message: accessError };
  const { credentials, error } = await getProjetEmailCredentials(createAdminClient(), projetId);
  if (error) return { ok: false, message: error };
  return tester(credentials);
}

export async function testerMaBoiteEnvoi(): Promise<ResultatTestBoite> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, message: "Non connecté·e." };
  const { credentials, error } = await getOwnerEmailCredentials(createAdminClient(), profile.id);
  if (error) return { ok: false, message: error };
  return tester(credentials);
}

async function tester(credentials: { user: string; pass: string } | null): Promise<ResultatTestBoite> {
  try {
    const res = await verifierBoiteEnvoi(credentials);
    if (res.error) return { ok: false, message: res.error };
    return { ok: true, message: `Connexion à ${res.user} réussie : les messages partiront bien de cette adresse.` };
  } catch (e) {
    // Ex. mot de passe enregistré illisible (clé de chiffrement changée).
    return { ok: false, message: e instanceof Error ? e.message : "Test impossible." };
  }
}
