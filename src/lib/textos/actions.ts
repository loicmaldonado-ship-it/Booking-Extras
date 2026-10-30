"use server";

import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
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
  // Remontée des réponses texto (lecture de l'app Messages sur le Mac).
  reponsesLe: string | null;
  reponsesErreur: string | null;
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
    supabase.from("relais_textos").select("derniere_activite, reponses_le, reponses_erreur").eq("profile_id", profile.id).maybeSingle(),
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
    reponsesLe: relais?.reponses_le ?? null,
    reponsesErreur: relais?.reponses_erreur ?? null,
  };
}

type LigneTexto = {
  profile_id: string;
  telephone: string;
  destinataire: string;
  message: string;
  figurant_id: string | null;
  projet_id: string | null;
};

function lignesTextos(profileId: string, destinataires: DestinataireTexto[]) {
  const sansNumero: string[] = [];
  const lignes: LigneTexto[] = [];
  // Entrée venant du navigateur : forme vérifiée ici (le 30/10/2026, un élément incomplet faisait planter l'action).
  const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  for (const d of (Array.isArray(destinataires) ? destinataires : []).slice(0, MAX_PAR_ENVOI)) {
    if (!d || typeof d !== "object") continue;
    const nom = typeof d.nom === "string" ? d.nom : "";
    const tel = typeof d.telephone === "string" ? telephoneInternational(d.telephone) : null;
    const texte = typeof d.texte === "string" ? d.texte.trim() : "";
    if (!tel || !texte) {
      sansNumero.push(nom);
      continue;
    }
    lignes.push({
      profile_id: profileId,
      telephone: tel,
      destinataire: nom.slice(0, 120),
      message: texte.slice(0, 2000),
      figurant_id: uuid(d.figurantId),
      projet_id: uuid(d.projetId),
    });
  }
  return { lignes, sansNumero };
}

// Revue indépendante du 30/10/2026 : figurant_id / projet_id venaient du navigateur sans contrôle ; une personne d'une
// équipe pouvait rattacher un numéro à un projet et un profil d'une autre équipe (ses réponses SMS arrivaient alors
// dans la messagerie de l'autre équipe). Projet accessible ET profil lié à ce projet, sinon les deux sont ignorés.
async function rattachementsVerifies(lignes: LigneTexto[]): Promise<LigneTexto[]> {
  const supabase = createAdminClient();
  const acces = new Map<string, boolean>();
  const lies = new Map<string, boolean>();
  for (const l of lignes) {
    if (!l.projet_id) { l.figurant_id = null; continue; }
    if (!acces.has(l.projet_id)) acces.set(l.projet_id, !(await checkProjetAccess(l.projet_id)));
    let ok = acces.get(l.projet_id) === true && !!l.figurant_id;
    if (ok) {
      const cle = `${l.projet_id}:${l.figurant_id}`;
      if (!lies.has(cle)) {
        const f = l.figurant_id!, p = l.projet_id;
        const [b, c, e, k] = await Promise.all([
          supabase.from("bookings").select("id", { count: "exact", head: true }).eq("projet_id", p).eq("figurant_id", f),
          supabase.from("casting_entries").select("id", { count: "exact", head: true }).eq("projet_id", p).eq("figurant_id", f),
          supabase.from("essayages").select("id", { count: "exact", head: true }).eq("projet_id", p).eq("figurant_id", f),
          supabase.from("candidatures").select("id, annonces!inner(projet_id)", { count: "exact", head: true }).eq("figurant_id", f).eq("annonces.projet_id", p),
        ]);
        lies.set(cle, [b, c, e, k].some((r) => !r.error && (r.count ?? 0) > 0));
      }
      ok = lies.get(cle) === true;
    }
    if (!ok) { l.figurant_id = null; l.projet_id = null; }
  }
  return lignes;
}

// Textos envoyés depuis l'iPhone (raccourci) : notés comme déjà envoyés,
// pour que le relais Mac sache que les réponses de ces numéros viennent
// d'un échange de l'appli.
export async function noterTextosEnvoyesIphone(destinataires: DestinataireTexto[]): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) return;
  const { lignes: brutes } = lignesTextos(profile.id, destinataires);
  if (brutes.length === 0) return;
  const lignes = await rattachementsVerifies(brutes);
  const maintenant = new Date().toISOString();
  await createAdminClient()
    .from("textos_file")
    .insert(lignes.map((l) => ({ ...l, statut: "envoye", pris_le: maintenant, envoye_le: maintenant })));
}

// Met des textos en file pour le relais Mac de la personne connectée.
export async function mettreEnFileTextos(
  destinataires: DestinataireTexto[]
): Promise<{ error?: string; enFile: number; sansNumero: string[] }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Non connecté·e.", enFile: 0, sansNumero: [] };
  const supabase = createAdminClient();
  const { data: relais } = await supabase.from("relais_textos").select("profile_id").eq("profile_id", profile.id).maybeSingle();
  if (!relais) return { error: "Relais Mac pas encore installé (Mon compte → Textos).", enFile: 0, sansNumero: [] };

  const { lignes: brutes, sansNumero } = lignesTextos(profile.id, destinataires);
  const lignes = await rattachementsVerifies(brutes);
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
