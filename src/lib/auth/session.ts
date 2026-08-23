import "server-only";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type CurrentProfile = {
  id: string;
  email: string | null;
  nom: string | null;
  role: "chef" | "assistant";
};

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nom, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    email: user.email ?? null,
    nom: profile.nom,
    role: profile.role as "chef" | "assistant",
  };
}

// Returns null for a chef (unrestricted — full access) or the list of
// projet ids an assistant has been invited to (possibly empty).
export async function getAccessibleProjetIds(profile: CurrentProfile): Promise<string[] | null> {
  if (profile.role === "chef") return null;

  const admin = createAdminClient();
  const { data } = await admin.from("projet_membres").select("projet_id").eq("profile_id", profile.id);
  return (data ?? []).map((r) => r.projet_id);
}

// À appeler dans chaque page de détail/édition d'une ressource rattachée à
// un projet (booking, annonce, candidature, essayage...), une fois son
// projet_id connu — sans ça, un·e assistant·e non connecté à ce projet
// pouvait ouvrir la page en devinant/collant l'URL, même si les listes
// elles-mêmes sont bien filtrées. 404 plutôt qu'un message d'erreur, pour ne
// pas confirmer que la ressource existe.
export async function requireProjetAccess(projetId: string | null | undefined): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) notFound();
  if (!projetId) return;
  const accessibleIds = await getAccessibleProjetIds(profile);
  if (accessibleIds !== null && !accessibleIds.includes(projetId)) notFound();
}

// Même vérification que requireProjetAccess, mais pour les Server Actions
// (créer/modifier/supprimer) plutôt que pour le rendu d'une page — notFound()
// n'a pas de sens hors page, donc on retourne un message d'erreur exploitable
// par l'appelant (`if (err) return { error: err }`) au lieu de rediriger.
// Sans projetId fourni, l'action n'est pas rattachée à un projet précis : pas
// de vérification (comportement identique à requireProjetAccess).
export async function checkProjetAccess(projetId: string | null | undefined): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile) return "Non autorisé.";
  if (!projetId) return null;
  const accessibleIds = await getAccessibleProjetIds(profile);
  if (accessibleIds !== null && !accessibleIds.includes(projetId)) return "Accès non autorisé à ce projet.";
  return null;
}

// Réservé à la personne cheffe — la seule à avoir un accès illimité à tous
// les projets (voir getAccessibleProjetIds). À utiliser pour les actions
// sensibles sans projet précis à vérifier (créer un projet, inviter/révoquer
// un accès, RGPD...). Lève une erreur — pensé pour les actions qui
// n'utilisent pas déjà le pattern `{ error }`.
export async function requireChef(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "chef") {
    throw new Error("Réservé au·à la chef·fe.");
  }
  return profile;
}

// Safe to spread into a Supabase `.in("id", ...)` filter even when the list
// is empty — an empty `.in()` would otherwise match nothing predictably
// across drivers, so this guarantees a no-match sentinel instead.
export function idsOrNone(ids: string[]) {
  return ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"];
}
