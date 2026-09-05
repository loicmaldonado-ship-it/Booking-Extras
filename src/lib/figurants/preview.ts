"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCachedSignedUrl } from "@/lib/supabase/signed-urls";
import { getCurrentProfile, getAccessibleProjetIds, idsOrNone } from "@/lib/auth/session";
import type { FigurantMessage } from "@/lib/candidats/types";

export type PreviewBooking = {
  id: string;
  date: string;
  fonction: string | null;
  cachet: string | null;
  statut: string;
  projetLabel: string;
};

export type PreviewMessage = FigurantMessage & { projetLabel: string | null };

export type FigurantPreview = {
  id: string;
  prenom: string;
  nom: string;
  ville: string | null;
  telephone: string | null;
  email: string | null;
  portraitUrl: string | null;
  bookings: PreviewBooking[];
  messages: PreviewMessage[];
};

// Données de l'aperçu rapide (popup) depuis Base Profils — volontairement
// limitées (dernières lignes seulement) et chargées à la demande (un
// figurant à la fois, à l'ouverture du popup), jamais pour toute une page
// de résultats d'un coup : voir le correctif de scale sur Base Profils.
const BOOKINGS_LIMIT = 15;
const MESSAGES_LIMIT = 30;

export async function getFigurantPreview(figurantId: string): Promise<FigurantPreview | { error: string }> {
  const supabase = createAdminClient();

  const { data: figurant } = await supabase
    .from("figurants")
    .select("id, prenom, nom, ville, telephone, email")
    .eq("id", figurantId)
    .maybeSingle();
  if (!figurant) return { error: "Profil introuvable." };

  const { data: photos } = await supabase
    .from("figurant_photos")
    .select("storage_path, type")
    .eq("figurant_id", figurantId)
    .eq("type", "portrait")
    .limit(1);
  const portraitPath = photos?.[0]?.storage_path;
  const portraitUrl = portraitPath ? await getCachedSignedUrl("figurant-photos", portraitPath) : null;

  const profile = await getCurrentProfile();
  const accessibleIds = profile ? await getAccessibleProjetIds(profile) : null;

  let bookingsQuery = supabase
    .from("bookings")
    .select("id, date, fonction, cachet, statut, projet_id, projets(nom, nom_code)")
    .eq("figurant_id", figurantId)
    .order("date", { ascending: false })
    .limit(BOOKINGS_LIMIT);
  if (accessibleIds !== null) bookingsQuery = bookingsQuery.in("projet_id", idsOrNone(accessibleIds));
  const { data: bookingsRaw } = await bookingsQuery.returns<
    { id: string; date: string; fonction: string | null; cachet: string | null; statut: string; projet_id: string; projets: { nom: string; nom_code: string | null } | null }[]
  >();

  let messagesQuery = supabase
    .from("figurant_messages")
    .select("*")
    .eq("figurant_id", figurantId)
    .order("created_at", { ascending: false })
    .limit(MESSAGES_LIMIT);
  if (accessibleIds !== null) {
    messagesQuery = messagesQuery.or(`projet_id.is.null,projet_id.in.(${idsOrNone(accessibleIds).join(",")})`);
  }
  const { data: messagesRaw } = await messagesQuery.returns<FigurantMessage[]>();

  const projetIds = Array.from(new Set((messagesRaw ?? []).map((m) => m.projet_id).filter((id): id is string => !!id)));
  const { data: projets } =
    projetIds.length > 0 ? await supabase.from("projets").select("id, nom, nom_code").in("id", projetIds) : { data: [] };
  const projetLabelById = new Map((projets ?? []).map((p) => [p.id, p.nom_code || p.nom]));

  return {
    id: figurant.id,
    prenom: figurant.prenom,
    nom: figurant.nom,
    ville: figurant.ville,
    telephone: figurant.telephone,
    email: figurant.email,
    portraitUrl,
    bookings: (bookingsRaw ?? []).map((b) => ({
      id: b.id,
      date: b.date,
      fonction: b.fonction,
      cachet: b.cachet,
      statut: b.statut,
      projetLabel: b.projets?.nom_code || b.projets?.nom || "Projet",
    })),
    messages: (messagesRaw ?? []).map((m) => ({
      ...m,
      projetLabel: m.projet_id ? projetLabelById.get(m.projet_id) ?? null : null,
    })),
  };
}
