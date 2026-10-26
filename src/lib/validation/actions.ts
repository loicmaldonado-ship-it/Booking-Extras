"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkProjetAccess, getCurrentProfile } from "@/lib/auth/session";
import { createNotification } from "@/lib/notifications/create";
import { nomComplet } from "@/lib/noms";
import { profilDansLien, type LienValidation, type VoteMes } from "./data";

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

// Lien de toutes les journées : d'une annonce (Candidatures) ou d'un
// projet (Bookings). Il se remplit tout seul avec les profils des
// journées, rien n'est à cocher.
export async function creerLienValidation(
  cible: { annonceId: string } | { projetId: string },
  nom: string
): Promise<{ error?: string; token?: string }> {
  const supabase = createAdminClient();
  let projetId: string;
  let annonceId: string | null = null;
  if ("annonceId" in cible) {
    const { data: annonce } = await supabase.from("annonces").select("projet_id").eq("id", cible.annonceId).maybeSingle();
    if (!annonce) return { error: "Annonce introuvable." };
    projetId = annonce.projet_id;
    annonceId = cible.annonceId;
  } else {
    projetId = cible.projetId;
  }
  const accessError = await checkProjetAccess(projetId);
  if (accessError) return { error: accessError };
  const profile = await getCurrentProfile();

  const { data: lien, error } = await supabase
    .from("liens_validation")
    .insert({
      annonce_id: annonceId,
      projet_id: projetId,
      source: annonceId ? "candidatures" : "bookings",
      nom: nom.trim().slice(0, 120) || "Validation",
      created_by: profile?.id ?? null,
      toutes_journees: true,
    })
    .select("token")
    .single();
  if (error || !lien) return { error: error?.message ?? "Création impossible." };
  revalidatePath(annonceId ? "/candidatures" : "/bookings");
  return { token: lien.token };
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
  revalidatePath("/bookings");
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
  revalidatePath("/bookings");
  return {};
}

// ---------- Côté MES / réal (lien public, sans compte) ----------

async function lienPublic(token: string): Promise<LienValidation | null> {
  if (!TOKEN_RE.test(token)) return null;
  const { data } = await createAdminClient()
    .from("liens_validation")
    .select("id, token, nom, annonce_id, projet_id, created_at, toutes_journees, source")
    .eq("token", token)
    // Validation MES : seulement depuis Bookings.
    .eq("source", "bookings")
    .maybeSingle<LienValidation>();
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

// Où l'équipe retrouve les votes, selon la source du lien.
const retour = (lien: LienValidation) =>
  lien.source === "bookings" ? "/bookings?liens=1" : `/candidatures?annonce_id=${lien.annonce_id}&onglet_id=mes`;

async function nomDuProfil(lien: LienValidation, profilId: string) {
  const supabase = createAdminClient();
  if (lien.source === "bookings") {
    const { data } = await supabase.from("figurants").select("prenom, nom").eq("id", profilId).maybeSingle();
    return nomComplet(data);
  }
  const { data } = await supabase
    .from("candidatures")
    .select("figurants(prenom, nom)")
    .eq("id", profilId)
    .maybeSingle<{ figurants: { prenom: string; nom: string } | null }>();
  return nomComplet(data?.figurants);
}

// Arrivée sur le lien (prénom + rôle) puis toutes les ~30 s tant que la page
// est ouverte : sert à « qui a vu » et « en ligne » côté équipe.
export async function signalerVisite(token: string, visiteurId: string, prenom: string, role: string): Promise<{ error?: string }> {
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
  profilId: string,
  vote: VoteMes | null,
  note: string
): Promise<{ error?: string }> {
  const lien = await lienPublic(token);
  if (!lien || !VISITEUR_RE.test(visiteurId)) return { error: "Lien invalide." };
  if (vote !== null && !["oui", "non"].includes(vote)) return { error: "Vote invalide." };
  const [dansLeLien, v] = await Promise.all([profilDansLien(lien, profilId), visiteur(lien.id, visiteurId)]);
  if (!dansLeLien) return { error: "Ce profil n'est plus dans le lien." };
  if (!v) return { error: "Indique d'abord ton prénom." };

  const supabase = createAdminClient();
  const colonne = lien.source === "bookings" ? "figurant_id" : "candidature_id";
  const { data: avant } = await supabase
    .from("lien_validation_votes")
    .select("vote")
    .eq("lien_id", lien.id)
    .eq(colonne, profilId)
    .eq("visiteur_id", visiteurId)
    .maybeSingle();
  const { error } = await supabase.from("lien_validation_votes").upsert(
    {
      lien_id: lien.id,
      [colonne]: profilId,
      visiteur_id: visiteurId,
      visiteur_nom: v.prenom,
      visiteur_role: v.role,
      vote,
      note: note.trim().slice(0, 500),
      updated_at: new Date().toISOString(),
    },
    { onConflict: `lien_id,${colonne},visiteur_id` }
  );
  if (error) return { error: error.message };
  if (vote && avant?.vote !== vote) {
    const verbe = vote === "oui" ? "a validé" : "a écarté";
    await createNotification("validation", `${qui(v)} ${verbe} ${await nomDuProfil(lien, profilId)} · ${lien.nom}`, {
      projetId: lien.projet_id,
      annonceId: lien.annonce_id,
      lien: retour(lien),
    });
  }
  return {};
}

export async function commenterLien(
  token: string,
  visiteurId: string,
  texte: string,
  profilId: string | null
): Promise<{ error?: string }> {
  const lien = await lienPublic(token);
  const t = texte.trim().slice(0, 2000);
  if (!lien || !VISITEUR_RE.test(visiteurId)) return { error: "Lien invalide." };
  if (!t) return { error: "Message vide." };
  const v = await visiteur(lien.id, visiteurId);
  if (!v) return { error: "Indique d'abord ton prénom." };
  const profil = profilId && (await profilDansLien(lien, profilId)) ? profilId : null;
  const { error } = await createAdminClient()
    .from("partage_commentaires")
    .insert({
      lien_type: "validation",
      lien_id: lien.id,
      visiteur_id: visiteurId,
      auteur: qui(v),
      candidature_id: lien.source === "candidatures" ? profil : null,
      figurant_id: lien.source === "bookings" ? profil : null,
      texte: t,
    });
  if (error) return { error: error.message };
  await createNotification("validation", `💬 ${qui(v)} sur « ${lien.nom} » : ${t.slice(0, 80)}`, {
    projetId: lien.projet_id,
    annonceId: lien.annonce_id,
    lien: lien.source === "bookings" ? "/bookings?liens=1" : `/candidatures?annonce_id=${lien.annonce_id}&liens=1`,
  });
  return {};
}
