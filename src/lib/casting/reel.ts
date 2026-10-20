"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";
import { nomComplet } from "@/lib/noms";
import { getReelOptions, type OptionsReel } from "@/lib/partage/data";
import { AVIS_LIBELLES, type Avis } from "@/lib/casting/avis";

// Retour du·de la réal sur le lien casting : avis Oui / Peut-être / Non et
// commentaires par profil, chacun si l'équipe l'a activé sur le lien.
// Personne n'a de compte : le·la visiteur·se est reconnu·e par l'identité
// du navigateur (voir partage/visiteur.tsx) et son prénom, demandé au
// moment de donner un avis ou d'écrire.


const VISITEUR_RE = /^[A-Za-z0-9-]{8,64}$/;
const TOKEN_RE = /^[A-Za-z0-9-]{16,64}$/;

async function lienCasting(token: string): Promise<{ id: string; projetId: string; categorie: string | null; options: OptionsReel } | null> {
  if (!TOKEN_RE.test(token)) return null;
  const { data } = await createAdminClient().from("partage_liens").select("id, projet_id, categorie").eq("token", token).eq("type", "casting").maybeSingle();
  if (!data) return null;
  return { id: data.id, projetId: data.projet_id, categorie: data.categorie, options: await getReelOptions({ token }) };
}

// Un profil visible sur ce lien (même règle que la page publique).
async function profilVisible(projetId: string, entryId: string, categorie: string | null) {
  const { data } = await createAdminClient()
    .from("casting_entries")
    .select("id, figurants(prenom, nom), casting_roles(nom, visible_partage, categorie_cachet)")
    .eq("id", entryId)
    .eq("projet_id", projetId)
    .eq("visible_partage", true)
    .maybeSingle<{ id: string; figurants: { prenom: string; nom: string } | null; casting_roles: { nom: string; visible_partage: boolean; categorie_cachet: string } | null }>();
  if (!data || !data.casting_roles?.visible_partage) return null;
  if (categorie && data.casting_roles.categorie_cachet !== categorie) return null;
  return { nom: nomComplet(data.figurants), role: data.casting_roles.nom };
}

async function visiteur(lienId: string, visiteurId: string) {
  const { data } = await createAdminClient()
    .from("partage_visites")
    .select("prenom, role")
    .eq("lien_type", "casting")
    .eq("lien_id", lienId)
    .eq("visiteur_id", visiteurId)
    .maybeSingle();
  return data;
}

const qui = (v: { prenom: string; role: string }) => (v.role ? `${v.prenom} (${v.role})` : v.prenom);

// Mes avis (par profil), pour réafficher mes choix à chaque ouverture.
export async function lireMesAvis(token: string, visiteurId: string): Promise<Record<string, Avis>> {
  const lien = await lienCasting(token);
  if (!lien || !lien.options.avis || !VISITEUR_RE.test(visiteurId)) return {};
  const { data } = await createAdminClient()
    .from("casting_avis")
    .select("entry_id, avis")
    .eq("lien_id", lien.id)
    .eq("visiteur_id", visiteurId)
    .returns<{ entry_id: string; avis: Avis }[]>();
  return Object.fromEntries((data ?? []).map((a) => [a.entry_id, a.avis]));
}

// null retire l'avis (re-toucher le même bouton).
export async function donnerAvis(token: string, visiteurId: string, entryId: string, avis: Avis | null): Promise<{ error?: string }> {
  const lien = await lienCasting(token);
  if (!lien || !lien.options.avis || !VISITEUR_RE.test(visiteurId)) return { error: "Lien invalide." };
  if (avis !== null && !(avis in AVIS_LIBELLES)) return { error: "Avis invalide." };
  const [profil, v] = await Promise.all([profilVisible(lien.projetId, entryId, lien.categorie), visiteur(lien.id, visiteurId)]);
  if (!profil) return { error: "Ce profil n'est plus sur le lien." };
  if (!v) return { error: "Indique d'abord ton prénom." };

  const supabase = createAdminClient();
  if (avis === null) {
    await supabase.from("casting_avis").delete().eq("entry_id", entryId).eq("visiteur_id", visiteurId);
    return {};
  }
  const { data: avant } = await supabase.from("casting_avis").select("avis").eq("entry_id", entryId).eq("visiteur_id", visiteurId).maybeSingle();
  const { error } = await supabase.from("casting_avis").upsert(
    { lien_id: lien.id, entry_id: entryId, visiteur_id: visiteurId, visiteur_nom: v.prenom, visiteur_role: v.role, avis, updated_at: new Date().toISOString() },
    { onConflict: "entry_id,visiteur_id" }
  );
  if (error) return { error: error.message };
  if (avant?.avis !== avis) {
    await createNotification("partage", `${qui(v)} : « ${AVIS_LIBELLES[avis]} » pour ${profil.nom} (${profil.role})`, {
      projetId: lien.projetId,
      lien: "/casting",
    });
  }
  return {};
}

export type CommentaireProfil = { id: string; auteur: string; texte: string; created_at: string };

export async function commentairesProfil(token: string, entryId: string): Promise<CommentaireProfil[]> {
  const lien = await lienCasting(token);
  if (!lien || !lien.options.commentairesProfil) return [];
  const { data } = await createAdminClient()
    .from("partage_commentaires")
    .select("id, auteur, texte, created_at")
    .eq("lien_type", "casting")
    .eq("lien_id", lien.id)
    .eq("casting_entry_id", entryId)
    .order("created_at")
    .limit(100);
  return data ?? [];
}

export async function commenterProfil(token: string, visiteurId: string, entryId: string, texte: string): Promise<{ error?: string }> {
  const lien = await lienCasting(token);
  const t = texte.trim().slice(0, 2000);
  if (!lien || !lien.options.commentairesProfil || !VISITEUR_RE.test(visiteurId)) return { error: "Lien invalide." };
  if (!t) return { error: "Message vide." };
  const [profil, v] = await Promise.all([profilVisible(lien.projetId, entryId, lien.categorie), visiteur(lien.id, visiteurId)]);
  if (!profil) return { error: "Ce profil n'est plus sur le lien." };
  if (!v) return { error: "Indique d'abord ton prénom." };
  const { error } = await createAdminClient()
    .from("partage_commentaires")
    .insert({ lien_type: "casting", lien_id: lien.id, visiteur_id: visiteurId, auteur: qui(v), casting_entry_id: entryId, texte: t });
  if (error) return { error: error.message };
  await createNotification("partage", `💬 ${qui(v)} sur ${profil.nom} (${profil.role}) : ${t.slice(0, 80)}`, {
    projetId: lien.projetId,
    lien: "/casting",
  });
  return {};
}
