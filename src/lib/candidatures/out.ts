import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Onglet « OUT » (fixe, commun à toutes les annonces) : une candidature
// rangée là disparaît de l'annonce (sauf dans l'onglet OUT) et la personne
// reçoit un message dans son espace, une seule fois par candidature ;
// le message est retiré si la candidature sort de OUT (erreur de clic).

export async function getOngletOutId(): Promise<string | null> {
  const { data } = await createAdminClient()
    .from("candidature_onglets")
    .select("id")
    .eq("fixe", true)
    .is("annonce_id", null)
    .maybeSingle();
  return data?.id ?? null;
}

export function messageNonRetenu(titreAnnonce: string): string {
  return [
    `Désolé, vous n'avez pas été retenu·e pour l'annonce « ${titreAnnonce} ».`,
    "Un grand merci pour votre candidature, et à tout bientôt !",
    "",
    "L'équipe Booking Extras",
  ].join("\n");
}

type Avant = { id: string; onglet_id: string | null; figurant_id: string; annonces: { titre: string; projet_id: string } | null };

// À appeler avec l'état AVANT le changement d'onglet.
export async function lireOngletsAvant(candidatureIds: string[]): Promise<Avant[]> {
  const supabase = createAdminClient();
  const lignes: Avant[] = [];
  for (let i = 0; i < candidatureIds.length; i += 150) {
    const { data } = await supabase
      .from("candidatures")
      .select("id, onglet_id, figurant_id, annonces(titre, projet_id)")
      .in("id", candidatureIds.slice(i, i + 150))
      .returns<Avant[]>();
    lignes.push(...(data ?? []));
  }
  return lignes;
}

export async function appliquerMessagesOut(avant: Avant[], nouvelOngletId: string | null) {
  const outId = await getOngletOutId();
  if (!outId) return;
  const supabase = createAdminClient();

  const entrees = avant.filter((c) => c.onglet_id !== outId && nouvelOngletId === outId);
  const sorties = avant.filter((c) => c.onglet_id === outId && nouvelOngletId !== outId);

  if (sorties.length > 0) {
    await supabase
      .from("figurant_messages")
      .delete()
      .eq("categorie", "non_retenu")
      .in(
        "candidature_id",
        sorties.map((c) => c.id)
      );
  }

  if (entrees.length > 0) {
    const { data: deja } = await supabase
      .from("figurant_messages")
      .select("candidature_id")
      .eq("categorie", "non_retenu")
      .in(
        "candidature_id",
        entrees.map((c) => c.id)
      );
    const dejaPrevenues = new Set((deja ?? []).map((m) => m.candidature_id));
    const messages = entrees
      .filter((c) => !dejaPrevenues.has(c.id))
      .map((c) => ({
        figurant_id: c.figurant_id,
        projet_id: c.annonces?.projet_id ?? null,
        candidature_id: c.id,
        sender: "staff",
        categorie: "non_retenu",
        corps: messageNonRetenu(c.annonces?.titre ?? "votre annonce"),
      }));
    if (messages.length > 0) await supabase.from("figurant_messages").insert(messages);
  }
}
