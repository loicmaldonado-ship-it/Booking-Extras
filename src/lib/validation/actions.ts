"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/create";
import { nomComplet } from "@/lib/noms";
import type { VoteMes } from "./data";

const VISITEUR_RE = /^[A-Za-z0-9-]{8,64}$/;
const TOKEN_RE = /^[0-9a-f]{32}$/;

// ---------- Côté équipe ----------

async function lienAvecAcces(lienId: string) {
  const { data: lien } = await createAdminClient()
    .from("liens_validation")
    .select("id, annonce_id, projet_id, nom")
    .eq("id", lienId)
    .maybeSingle();
  if (!lien) return { error: "Lien introuvable." as const };
  const accessError = await checkProjetAccess(lien.projet_id);
  if (accessError) return { error: accessError };
  return { lien };
}

// Ne garde que des candidatures de cette annonce.
async function candidaturesDeLAnnonce(annonceId: string, ids: string[]) {
  const ok: string[] = [];
  const supabase = createAdminClient();
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase
      .from("candidatures")
      .select("id")
      .eq("annonce_id", annonceId)
      .in("id", ids.slice(i, i + 150));
    ok.push(...(data ?? []).map((c) => c.id));
  }
  return ids.filter((id) => ok.includes(id));
}

export async function creerLienValidation(
  annonceId: string,
  nom: string,
  candidatureIds: string[]
): Promise<{ error?: string; token?: string }> {
  const supabase = createAdminClient();
  const { data: annonce } = await supabase.from("annonces").select("projet_id").eq("id", annonceId).maybeSingle();
  if (!annonce) return { error: "Annonce introuvable." };
  const accessError = await checkProjetAccess(annonce.projet_id);
  if (accessError) return { error: accessError };
  const profile = await getCurrentProfile();
  const ids = await candidaturesDeLAnnonce(annonceId, Array.from(new Set(candidatureIds)).slice(0, 500));
  if (ids.length === 0) return { error: "Aucun profil à mettre dans le lien." };

  const { data: lien, error } = await supabase
    .from("liens_validation")
    .insert({ annonce_id: annonceId, projet_id: annonce.projet_id, nom: nom.trim().slice(0, 120) || "Validation", created_by: profile?.id ?? null })
    .select("id, token")
    .single();
  if (error || !lien) return { error: error?.message ?? "Création impossible." };
  const { error: errProfils } = await supabase
    .from("lien_validation_profils")
    .insert(ids.map((candidature_id, ordre) => ({ lien_id: lien.id, candidature_id, ordre })));
  if (errProfils) return { error: errProfils.message };
  revalidatePath("/candidatures");
  return { token: lien.token };
}

export async function ajouterAuLienValidation(lienId: string, candidatureIds: string[]): Promise<{ error?: string; ajoutes?: number }> {
  const res = await lienAvecAcces(lienId);
  if ("error" in res) return { error: res.error };
  const supabase = createAdminClient();
  const ids = await candidaturesDeLAnnonce(res.lien.annonce_id, Array.from(new Set(candidatureIds)).slice(0, 500));
  const { count } = await supabase
    .from("lien_validation_profils")
    .select("candidature_id", { count: "exact", head: true })
    .eq("lien_id", lienId);
  const { error, data } = await supabase
    .from("lien_validation_profils")
    .upsert(
      ids.map((candidature_id, i) => ({ lien_id: lienId, candidature_id, ordre: (count ?? 0) + i })),
      { onConflict: "lien_id,candidature_id", ignoreDuplicates: true }
    )
    .select("candidature_id");
  if (error) return { error: error.message };
  revalidatePath("/candidatures");
  return { ajoutes: data?.length ?? 0 };
}

export async function retirerDuLienValidation(lienId: string, candidatureId: string): Promise<{ error?: string }> {
  const res = await lienAvecAcces(lienId);
  if ("error" in res) return { error: res.error };
  const { error } = await createAdminClient()
    .from("lien_validation_profils")
    .delete()
    .eq("lien_id", lienId)
    .eq("candidature_id", candidatureId);
  if (error) return { error: error.message };
  revalidatePath("/candidatures");
  return {};
}

export async function supprimerLienValidation(lienId: string): Promise<{ error?: string }> {
  const res = await lienAvecAcces(lienId);
  if ("error" in res) return { error: res.error };
  const supabase = createAdminClient();
  await supabase.from("partage_commentaires").delete().eq("lien_type", "validation").eq("lien_id", lienId);
  await supabase.from("partage_visites").delete().eq("lien_type", "validation").eq("lien_id", lienId);
  const { error } = await supabase.from("liens_validation").delete().eq("id", lienId);
  if (error) return { error: error.message };
  revalidatePath("/candidatures");
  return {};
}

export async function repondreSurLien(lienId: string, texte: string): Promise<{ error?: string }> {
  const t = texte.trim().slice(0, 2000);
  if (!t) return { error: "Message vide." };
  const res = await lienAvecAcces(lienId);
  if ("error" in res) return { error: res.error };
  const profile = await getCurrentProfile();
  const { error } = await createAdminClient()
    .from("partage_commentaires")
    .insert({ lien_type: "validation", lien_id: lienId, profile_id: profile?.id ?? null, auteur: nomComplet(profile) || "Équipe casting", texte: t });
  if (error) return { error: error.message };
  revalidatePath("/candidatures");
  return {};
}

// ---------- Côté MES / réal (lien public, sans compte) ----------

async function lienPublic(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const { data } = await createAdminClient()
    .from("liens_validation")
    .select("id, annonce_id, projet_id, nom")
    .eq("token", token)
    .maybeSingle();
  return data;
}

async function visiteur(lienId: string, visiteurId: string) {
  const { data } = await createAdminClient()
    .from("partage_visites")
    .select("prenom, role")
    .eq("lien_type", "validation")
    .eq("lien_id", lienId)
    .eq("visiteur_id", visiteurId)
    .maybeSingle();
  return data;
}

const qui = (v: { prenom: string; role: string }) => (v.role ? `${v.prenom} (${v.role})` : v.prenom);

// Arrivée sur le lien (prénom + rôle) puis toutes les ~30 s tant que la page
// est ouverte : sert à « qui a vu » et « en ligne » côté équipe.
export async function signalerVisite(
  token: string,
  visiteurId: string,
  prenom: string,
  role: string
): Promise<{ error?: string }> {
  const lien = await lienPublic(token);
  const p = prenom.trim().slice(0, 60);
  if (!lien || !VISITEUR_RE.test(visiteurId) || !p) return { error: "Lien invalide." };
  const { error } = await createAdminClient()
    .from("partage_visites")
    .upsert(
      { lien_type: "validation", lien_id: lien.id, visiteur_id: visiteurId, prenom: p, role: role.trim().slice(0, 60), derniere_vue: new Date().toISOString() },
      { onConflict: "lien_type,lien_id,visiteur_id" }
    );
  return error ? { error: error.message } : {};
}

export async function voterProfil(
  token: string,
  visiteurId: string,
  candidatureId: string,
  vote: VoteMes | null,
  note: string
): Promise<{ error?: string }> {
  const lien = await lienPublic(token);
  if (!lien || !VISITEUR_RE.test(visiteurId)) return { error: "Lien invalide." };
  if (vote !== null && !["oui", "peut", "non"].includes(vote)) return { error: "Vote invalide." };
  const supabase = createAdminClient();
  const [{ data: dansLeLien }, v] = await Promise.all([
    supabase
      .from("lien_validation_profils")
      .select("candidature_id, candidatures(figurants(prenom, nom))")
      .eq("lien_id", lien.id)
      .eq("candidature_id", candidatureId)
      .maybeSingle<{ candidature_id: string; candidatures: { figurants: { prenom: string; nom: string } | null } | null }>(),
    visiteur(lien.id, visiteurId),
  ]);
  if (!dansLeLien) return { error: "Ce profil n'est plus dans le lien." };
  if (!v) return { error: "Indique d'abord ton prénom." };

  const { data: avant } = await supabase
    .from("lien_validation_votes")
    .select("vote")
    .eq("lien_id", lien.id)
    .eq("candidature_id", candidatureId)
    .eq("visiteur_id", visiteurId)
    .maybeSingle();
  const { error } = await supabase.from("lien_validation_votes").upsert(
    {
      lien_id: lien.id,
      candidature_id: candidatureId,
      visiteur_id: visiteurId,
      visiteur_nom: v.prenom,
      visiteur_role: v.role,
      vote,
      note: note.trim().slice(0, 500),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "lien_id,candidature_id,visiteur_id" }
  );
  if (error) return { error: error.message };
  if (vote && avant?.vote !== vote) {
    const verbe = vote === "oui" ? "a validé" : vote === "peut" ? "a mis en peut-être" : "a écarté";
    await createNotification("validation", `${qui(v)} ${verbe} ${nomComplet(dansLeLien.candidatures?.figurants)} · ${lien.nom}`, {
      projetId: lien.projet_id,
      annonceId: lien.annonce_id,
      lien: `/candidatures?annonce_id=${lien.annonce_id}&onglet_id=mes`,
    });
  }
  return {};
}

export async function commenterLien(
  token: string,
  visiteurId: string,
  texte: string,
  candidatureId: string | null
): Promise<{ error?: string }> {
  const lien = await lienPublic(token);
  const t = texte.trim().slice(0, 2000);
  if (!lien || !VISITEUR_RE.test(visiteurId)) return { error: "Lien invalide." };
  if (!t) return { error: "Message vide." };
  const v = await visiteur(lien.id, visiteurId);
  if (!v) return { error: "Indique d'abord ton prénom." };
  const { data: profil } = candidatureId
    ? await createAdminClient()
        .from("lien_validation_profils")
        .select("candidature_id")
        .eq("lien_id", lien.id)
        .eq("candidature_id", candidatureId)
        .maybeSingle()
    : { data: null };
  candidatureId = profil?.candidature_id ?? null;
  const { error } = await createAdminClient().from("partage_commentaires").insert({
    lien_type: "validation",
    lien_id: lien.id,
    visiteur_id: visiteurId,
    auteur: qui(v),
    candidature_id: candidatureId,
    texte: t,
  });
  if (error) return { error: error.message };
  await createNotification("validation", `💬 ${qui(v)} sur « ${lien.nom} » : ${t.slice(0, 80)}`, {
    projetId: lien.projet_id,
    annonceId: lien.annonce_id,
    lien: `/candidatures?annonce_id=${lien.annonce_id}&liens=1`,
  });
  return {};
}
