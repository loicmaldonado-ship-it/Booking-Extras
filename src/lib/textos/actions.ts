"use server";

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hacherCle } from "./relais";
import { telephoneInternational, type DestinataireTexto } from "./telephone";

const MAX_PAR_ENVOI = 500;

// Clé du relais Mac : affichée une seule fois, seule son empreinte est
// gardée. En générer une nouvelle désactive l'ancienne.
export async function genererCleRelais(): Promise<{ error?: string; cle?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Non connecté·e." };
  const cle = `bx_${crypto.randomBytes(24).toString("base64url")}`;
  const { error } = await createAdminClient()
    .from("relais_textos")
    .upsert({ profile_id: profile.id, cle_hash: hacherCle(cle), derniere_activite: null }, { onConflict: "profile_id" });
  if (error) return { error: error.message };
  return { cle };
}

export type StatutRelais = {
  configure: boolean;
  // Le relais a contacté le site il y a moins de 2 minutes.
  actif: boolean;
  derniereActivite: string | null;
  enAttente: number;
  erreurs: number;
  envoyesAujourdhui: number;
};

export async function statutRelais(): Promise<StatutRelais | null> {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const supabase = createAdminClient();
  const debutJour = new Date();
  debutJour.setHours(0, 0, 0, 0);
  const compter = (statut: string, depuis?: string) => {
    let q = supabase.from("textos_file").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).eq("statut", statut);
    if (depuis) q = q.gte("envoye_le", depuis);
    return q;
  };
  const [{ data: relais }, { count: enAttente }, { count: envoi }, { count: erreurs }, { count: envoyes }] = await Promise.all([
    supabase.from("relais_textos").select("derniere_activite").eq("profile_id", profile.id).maybeSingle(),
    compter("en_attente"),
    compter("envoi"),
    compter("erreur"),
    compter("envoye", debutJour.toISOString()),
  ]);
  const derniere = relais?.derniere_activite ?? null;
  return {
    configure: !!relais,
    actif: !!derniere && Date.now() - new Date(derniere).getTime() < 2 * 60_000,
    derniereActivite: derniere,
    enAttente: (enAttente ?? 0) + (envoi ?? 0),
    erreurs: erreurs ?? 0,
    envoyesAujourdhui: envoyes ?? 0,
  };
}

// Met des textos en file pour le relais Mac de la personne connectée.
export async function mettreEnFileTextos(
  destinataires: DestinataireTexto[]
): Promise<{ error?: string; enFile: number; sansNumero: string[] }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Non connecté·e.", enFile: 0, sansNumero: [] };
  const supabase = createAdminClient();
  const { data: relais } = await supabase.from("relais_textos").select("profile_id").eq("profile_id", profile.id).maybeSingle();
  if (!relais) return { error: "Relais Mac pas encore installé (Équipe → Textos).", enFile: 0, sansNumero: [] };

  const sansNumero: string[] = [];
  const lignes: { profile_id: string; telephone: string; destinataire: string; message: string }[] = [];
  for (const d of destinataires.slice(0, MAX_PAR_ENVOI)) {
    const tel = telephoneInternational(d.telephone);
    const texte = d.texte.trim();
    if (!tel || !texte) {
      sansNumero.push(d.nom);
      continue;
    }
    lignes.push({ profile_id: profile.id, telephone: tel, destinataire: d.nom.slice(0, 120), message: texte.slice(0, 2000) });
  }
  if (lignes.length > 0) {
    const { error } = await supabase.from("textos_file").insert(lignes);
    if (error) return { error: error.message, enFile: 0, sansNumero };
  }
  return { enFile: lignes.length, sansNumero };
}

// Vide la file (textos pas encore partis).
export async function annulerFileTextos(): Promise<{ error?: string; annules?: number }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Non connecté·e." };
  const { data, error } = await createAdminClient()
    .from("textos_file")
    .update({ statut: "annule" })
    .eq("profile_id", profile.id)
    .eq("statut", "en_attente")
    .select("id");
  if (error) return { error: error.message };
  return { annules: data?.length ?? 0 };
}

// Texto d'essai vers son propre numéro (fiche membre), via le relais Mac.
export async function envoyerTextoTest(): Promise<{ error?: string; numero?: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Non connecté·e." };
  const numero = telephoneInternational(profile.telephone);
  if (!numero) return { error: "Ajoute ton numéro de portable dans Mon compte pour recevoir le texto d'essai." };
  const res = await mettreEnFileTextos([
    { nom: "Moi (essai)", telephone: numero, texte: "Booking Extras : ceci est un texto d'essai envoyé par ton relais Mac. 👍" },
  ]);
  if (res.error) return { error: res.error };
  return { numero };
}
