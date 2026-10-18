"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/create";
import { nomComplet } from "@/lib/noms";
import { formatDateShort } from "@/lib/format-date";

// Suivi des liens de partage (lien réal du casting, documents, essayages,
// lien d'une journée) : qui les a ouverts, qui est en ligne, et un fil de
// commentaires avec l'équipe. Les liens de validation MES ont leurs propres
// actions (lib/validation/actions.ts) sur les mêmes tables.

export type TypeLienSuivi = "casting" | "documents" | "essayages" | "journee";

const VISITEUR_RE = /^[A-Za-z0-9-]{8,64}$/;
const EN_LIGNE_MS = 70_000;

const LIBELLES: Record<TypeLienSuivi, string> = {
  casting: "le lien réal du casting",
  documents: "le lien documents",
  essayages: "le lien essayages",
  journee: "le lien de la journée",
};

type LienResolu = { type: TypeLienSuivi; id: string; projetId: string; libelle: string; retour: string };

async function lienParToken(token: string): Promise<LienResolu | null> {
  if (!/^[A-Za-z0-9-]{16,64}$/.test(token)) return null;
  const supabase = createAdminClient();
  const { data: lien } = await supabase.from("partage_liens").select("id, projet_id, type").eq("token", token).maybeSingle();
  if (lien && ["casting", "documents", "essayages"].includes(lien.type)) {
    const type = lien.type as TypeLienSuivi;
    return {
      type,
      id: lien.id,
      projetId: lien.projet_id,
      libelle: LIBELLES[type],
      retour: type === "casting" ? "/casting" : type === "essayages" ? "/essayages" : "/partage",
    };
  }
  const { data: journee } = await supabase.from("partage_journee_liens").select("id, projet_id, date").eq("token", token).maybeSingle();
  if (journee) {
    return {
      type: "journee",
      id: journee.id,
      projetId: journee.projet_id,
      libelle: `le lien de la journée du ${formatDateShort(journee.date)}`,
      retour: `/bookings/documents?projet_id=${journee.projet_id}&date=${journee.date}`,
    };
  }
  return null;
}

// Côté équipe : retrouve le lien d'un projet (et d'une date pour une journée).
async function lienDuProjet(projetId: string, type: TypeLienSuivi, date?: string) {
  const supabase = createAdminClient();
  if (type === "journee") {
    if (!date) return null;
    const { data } = await supabase.from("partage_journee_liens").select("id").eq("projet_id", projetId).eq("date", date).maybeSingle();
    return data?.id ?? null;
  }
  const { data } = await supabase.from("partage_liens").select("id").eq("projet_id", projetId).eq("type", type).maybeSingle();
  return data?.id ?? null;
}

export type CommentairePartage = { id: string; auteur: string; equipe: boolean; texte: string; created_at: string };

async function lireCommentaires(type: TypeLienSuivi, lienId: string): Promise<CommentairePartage[]> {
  const { data } = await createAdminClient()
    .from("partage_commentaires")
    .select("id, auteur, visiteur_id, texte, created_at")
    .eq("lien_type", type)
    .eq("lien_id", lienId)
    .order("created_at")
    .limit(300);
  return (data ?? []).map((c) => ({ id: c.id, auteur: c.auteur, equipe: !c.visiteur_id, texte: c.texte, created_at: c.created_at }));
}

// ---------- Page publique ----------

export async function signalerVisitePartage(token: string, visiteurId: string, prenom: string, role: string): Promise<{ error?: string }> {
  const lien = await lienParToken(token);
  const p = prenom.trim().slice(0, 60);
  if (!lien || !VISITEUR_RE.test(visiteurId) || !p) return { error: "Lien invalide." };
  const { error } = await createAdminClient()
    .from("partage_visites")
    .upsert(
      { lien_type: lien.type, lien_id: lien.id, visiteur_id: visiteurId, prenom: p, role: role.trim().slice(0, 60), derniere_vue: new Date().toISOString() },
      { onConflict: "lien_type,lien_id,visiteur_id" }
    );
  return error ? { error: error.message } : {};
}

export async function commentairesDuLien(token: string): Promise<CommentairePartage[]> {
  const lien = await lienParToken(token);
  return lien ? lireCommentaires(lien.type, lien.id) : [];
}

export async function commenterPartage(token: string, visiteurId: string, texte: string): Promise<{ error?: string }> {
  const lien = await lienParToken(token);
  const t = texte.trim().slice(0, 2000);
  if (!lien || !VISITEUR_RE.test(visiteurId)) return { error: "Lien invalide." };
  if (!t) return { error: "Message vide." };
  const supabase = createAdminClient();
  const { data: v } = await supabase
    .from("partage_visites")
    .select("prenom, role")
    .eq("lien_type", lien.type)
    .eq("lien_id", lien.id)
    .eq("visiteur_id", visiteurId)
    .maybeSingle();
  if (!v) return { error: "Indique d'abord ton prénom." };
  const qui = v.role ? `${v.prenom} (${v.role})` : v.prenom;
  const { error } = await supabase
    .from("partage_commentaires")
    .insert({ lien_type: lien.type, lien_id: lien.id, visiteur_id: visiteurId, auteur: qui, texte: t });
  if (error) return { error: error.message };
  await createNotification("partage", `💬 ${qui} sur ${lien.libelle} : ${t.slice(0, 80)}`, {
    projetId: lien.projetId,
    lien: lien.retour,
  });
  return {};
}

// ---------- Côté équipe ----------

export type SuiviPartage = {
  visites: { visiteur_id: string; prenom: string; role: string; derniere_vue: string; enLigne: boolean }[];
  commentaires: CommentairePartage[];
};

export async function lireSuiviPartage(projetId: string, type: TypeLienSuivi, date?: string): Promise<SuiviPartage | { error: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const lienId = await lienDuProjet(projetId, type, date);
  if (!lienId) return { visites: [], commentaires: [] };
  const [{ data: visites }, commentaires] = await Promise.all([
    createAdminClient()
      .from("partage_visites")
      .select("visiteur_id, prenom, role, derniere_vue")
      .eq("lien_type", type)
      .eq("lien_id", lienId)
      .order("derniere_vue", { ascending: false }),
    lireCommentaires(type, lienId),
  ]);
  const maintenant = Date.now();
  return {
    visites: (visites ?? []).map((v) => ({ ...v, enLigne: maintenant - new Date(v.derniere_vue).getTime() < EN_LIGNE_MS })),
    commentaires,
  };
}

export async function repondrePartage(projetId: string, type: TypeLienSuivi, texte: string, date?: string): Promise<{ error?: string }> {
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const t = texte.trim().slice(0, 2000);
  if (!t) return { error: "Message vide." };
  const lienId = await lienDuProjet(projetId, type, date);
  if (!lienId) return { error: "Lien introuvable." };
  const profile = await getCurrentProfile();
  const { error } = await createAdminClient()
    .from("partage_commentaires")
    .insert({ lien_type: type, lien_id: lienId, profile_id: profile?.id ?? null, auteur: nomComplet(profile) || "Équipe casting", texte: t });
  return error ? { error: error.message } : {};
}
