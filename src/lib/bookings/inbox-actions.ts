"use server";

import { revalidatePath } from "next/cache";
import { checkProjetAccess } from "@/lib/auth/session";
import {
  getUnreviewedReplies,
  clearUnreviewedReplies as clearUnreviewedRepliesInbox,
  figurantsDeLaJournee,
} from "@/lib/email/inbox";
import { releverReponsesMail, marquerMailLu } from "@/lib/email/releve";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProjetEmailCredentials } from "@/lib/projets/email";

// Relève les réponses dans la boîte d'envoi du projet (celle configurée par
// la cheffe), puis renvoie la liste des réponses pas encore effacées des
// personnes de la journée (date). La relève tourne aussi toute seule
// (tâche planifiée + onglet Messages ouvert).
export async function checkEmailReplies(projetId?: string | null, date?: string | null) {
  if (!projetId) return { checked: 0, matched: [] as { id: string }[], unmatchedCount: 0, replies: [], error: "Projet inconnu." };
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { checked: 0, matched: [] as { id: string }[], unmatchedCount: 0, replies: [], error: accessError };

  const resultats = await releverReponsesMail(projetId);
  const nouvelles = resultats.reduce((n, r) => n + r.nouvelles, 0);
  const erreur = resultats.find((r) => r.erreur)?.erreur;
  if (nouvelles > 0) {
    revalidatePath("/figurants");
    revalidatePath("/bookings/documents");
  }
  const replies = await getUnreviewedReplies(projetId, date ? await figurantsDeLaJournee(projetId, date) : undefined);
  return {
    checked: nouvelles,
    matched: Array.from({ length: nouvelles }, (_, i) => ({ id: String(i) })),
    unmatchedCount: 0,
    replies,
    error: erreur ? `Boîte mail du projet : ${erreur}` : undefined,
  };
}

// Relève automatique depuis l'onglet Messages ouvert : au plus une fois par
// minute et par boîte (la tâche planifiée passe aussi toutes les 5 min).
export async function releverReponsesAuto(projetId: string): Promise<{ nouvelles: number; releveLe: string | null; erreur?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { nouvelles: 0, releveLe: null, erreur: accessError };

  const supabase = createAdminClient();
  const { credentials, error } = await getProjetEmailCredentials(supabase, projetId);
  if (!credentials && error) return { nouvelles: 0, releveLe: null, erreur: error };
  const boite = (credentials?.user ?? process.env.GMAIL_SMTP_USER ?? "").toLowerCase();
  const { data: etat } = await supabase.from("boites_mail_releve").select("releve_le").eq("boite", boite).maybeSingle();
  if (etat?.releve_le && Date.now() - new Date(etat.releve_le).getTime() < 60 * 1000) {
    return { nouvelles: 0, releveLe: etat.releve_le };
  }

  const resultats = await releverReponsesMail(projetId);
  const nouvelles = resultats.reduce((n, r) => n + r.nouvelles, 0);
  if (nouvelles > 0) revalidatePath("/bookings/documents");
  return { nouvelles, releveLe: new Date().toISOString(), erreur: resultats.find((r) => r.erreur)?.erreur };
}

export async function clearUnreviewedReplies(messageIds: string[]) {
  const supabase = createAdminClient();
  const { data } = await supabase.from("figurant_messages").select("id, projet_id").in("id", messageIds.slice(0, 500));
  const projets = [...new Set((data ?? []).map((m) => m.projet_id).filter((p): p is string => !!p))];
  for (const p of projets) {
    const accessError = await checkProjetAccess(p);
    if (accessError) return;
  }
  await clearUnreviewedRepliesInbox((data ?? []).map((m) => m.id));
  revalidatePath("/bookings/documents");
}

// Bouton « Marquer comme lu dans Gmail » sur une réponse traitée.
export async function marquerReponseLueGmail(messageRowId: string): Promise<{ error?: string }> {
  const { data } = await createAdminClient().from("figurant_messages").select("projet_id").eq("id", messageRowId).maybeSingle();
  if (!data) return { error: "Message introuvable." };
  const accessError = await checkProjetAccess(data.projet_id);
  if (accessError) return { error: accessError };
  const res = await marquerMailLu(messageRowId);
  if (!res.error) revalidatePath("/bookings/documents");
  return res;
}
