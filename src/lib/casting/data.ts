import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedSignedUrls } from "@/lib/supabase/signed-urls";
import type { CastingRole, CastingEntry } from "./types";

export async function getCastingRoles(projetId: string): Promise<CastingRole[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("casting_roles")
    .select(
      "id, projet_id, nom, date_tournage, date_tournage_fin, date_limite_envoi, categorie_cachet, ordre, mode, nb_videos, photo_labels, demande_bande_demo, message_corps, visible_partage, pdf_storage_path, pdf_filename, created_at, public_token, lien_public_actif, questions"
    )
    .eq("projet_id", projetId)
    .order("ordre", { ascending: true })
    .returns<CastingRole[]>();

  return data ?? [];
}

export async function getCastingEntries(projetId: string): Promise<CastingEntry[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("casting_entries")
    .select(
      "id, projet_id, role_id, figurant_id, booking_id, candidature_id, request_token, video_storage_paths, video_labels, requested_at, submitted_at, statut, mode, notes, visible_partage, reponses, figurants(prenom, nom, email, telephone, adresse, code_postal, ville, genre, date_naissance, a_vehicule, vehicule_voiture, vehicule_velo, vehicule_moto, vehicule_scooter, compte_myrole, est_comedien, agent_nom, agent_email, agent_telephone, agent_agence, taille_cm, poids_kg, pointure, veste, pantalon)"
    )
    .eq("projet_id", projetId)
    .order("requested_at", { ascending: false })
    .returns<CastingEntry[]>();

  return data ?? [];
}

// Signe toutes les vidéos de tous les profils passés en une seule requête
// Storage, au lieu d'un appel createSignedUrl par vidéo par profil — voir
// getPhotosByFigurantId pour le même principe côté photos.
export async function getCastingVideoUrlPairsByEntries(
  entries: { id: string; video_storage_paths: string[]; video_labels?: string[] }[]
): Promise<Map<string, { path: string; url: string; label: string }[]>> {
  const map = new Map<string, { path: string; url: string; label: string }[]>();
  const allPaths = Array.from(new Set(entries.flatMap((e) => e.video_storage_paths))).sort();
  if (allPaths.length === 0) return map;

  const signedUrls = await getCachedSignedUrls("casting-videos", allPaths);
  const urlByPath = new Map(signedUrls.map((s) => [s.path, s.signedUrl ?? null]));

  for (const entry of entries) {
    const pairs = entry.video_storage_paths
      .map((path, i) => {
        const url = urlByPath.get(path);
        return url ? { path, url, label: entry.video_labels?.[i] || `Vidéo ${i + 1}` } : null;
      })
      .filter((p): p is { path: string; url: string; label: string } => !!p);
    if (pairs.length > 0) map.set(entry.id, pairs);
  }
  return map;
}

export type CastingEntryPhoto = { id: string; label: string; url: string };

// Les photos envoyées pour un casting (pas juste le portrait) — retrouvées
// via casting_entry_id, posé sur figurant_photos à la soumission.
export async function getCastingEntryPhotos(
  entryIds: string[]
): Promise<Map<string, CastingEntryPhoto[]>> {
  const map = new Map<string, CastingEntryPhoto[]>();
  if (entryIds.length === 0) return map;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("figurant_photos")
    .select("id, casting_entry_id, label, storage_path")
    .in("casting_entry_id", entryIds)
    .returns<{ id: string; casting_entry_id: string | null; label: string | null; storage_path: string }[]>();

  const photos = (data ?? []).filter((p) => p.casting_entry_id);

  // Une seule requête pour signer tous les chemins d'un coup, comme
  // getPhotosByFigurantId — un aller-retour Storage par photo ici faisait
  // ramper les rôles à beaucoup de profils. Passée par le cache partagé
  // (signed-urls.ts) pour réutiliser la même URL d'une vue à l'autre.
  const paths = photos.map((p) => p.storage_path).sort();
  const signedUrls = await getCachedSignedUrls("figurant-photos", paths);
  const urlByPath = new Map(signedUrls.map((s) => [s.path, s.signedUrl ?? null]));

  for (const photo of photos) {
    const url = urlByPath.get(photo.storage_path);
    if (!url) continue;
    const list = map.get(photo.casting_entry_id!) ?? [];
    list.push({ id: photo.id, label: photo.label ?? "Photo", url });
    map.set(photo.casting_entry_id!, list);
  }

  return map;
}

export type InvitationsRole = { invites: number; inscrits: number; envoyes: number };

// Suivi des invitations par email d'un projet, par rôle : combien invité·es,
// combien ont rejoint le rôle (fiche créée), combien ont tout envoyé.
export async function getInvitationsParRole(projetId: string): Promise<Map<string, InvitationsRole>> {
  const supabase = createAdminClient();
  const [{ data: invitations }, { data: entrees }] = await Promise.all([
    supabase
      .from("casting_invitations")
      .select("role_id, email, casting_roles!inner(projet_id)")
      .eq("casting_roles.projet_id", projetId),
    supabase
      .from("casting_entries")
      .select("role_id, submitted_at, figurants(email)")
      .eq("projet_id", projetId)
      .returns<{ role_id: string; submitted_at: string | null; figurants: { email: string | null } | null }[]>(),
  ]);
  const entreeParRoleEmail = new Map<string, { submitted: boolean }>();
  for (const e of entrees ?? []) {
    const email = e.figurants?.email?.toLowerCase();
    if (email) entreeParRoleEmail.set(`${e.role_id}|${email}`, { submitted: !!e.submitted_at });
  }
  const resultat = new Map<string, InvitationsRole>();
  for (const i of invitations ?? []) {
    const stats = resultat.get(i.role_id) ?? { invites: 0, inscrits: 0, envoyes: 0 };
    stats.invites += 1;
    const entree = entreeParRoleEmail.get(`${i.role_id}|${i.email}`);
    if (entree) stats.inscrits += 1;
    if (entree?.submitted) stats.envoyes += 1;
    resultat.set(i.role_id, stats);
  }
  return resultat;
}
