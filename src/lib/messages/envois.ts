import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { nomComplet } from "@/lib/noms";

export type EnvoiDestinataire = {
  id: string;
  figurant_id: string;
  booking_id: string | null;
  token: string;
  envoye_le: string | null;
  erreur: string | null;
  accuse_le: string | null;
  relances: number;
  derniere_relance_le: string | null;
};

export type EnvoiJournee = {
  id: string;
  titre: string;
  sujet: string;
  corps: string;
  canal: "email" | "texto";
  avec_accuse: boolean;
  created_at: string;
  // Membre de l'équipe qui l'a envoyé.
  auteur: string | null;
  destinataires: EnvoiDestinataire[];
};

// Envois (messages d'info suivis) d'une journée, du plus récent au plus
// ancien, avec l'état de chaque destinataire.
export async function getEnvoisJournee(projetId: string, date: string): Promise<EnvoiJournee[]> {
  const { data } = await createAdminClient()
    .from("envois")
    .select(
      "id, titre, sujet, corps, canal, avec_accuse, created_at, createur:profiles!envois_created_by_fkey(prenom, nom), envoi_destinataires(id, figurant_id, booking_id, token, envoye_le, erreur, accuse_le, relances, derniere_relance_le)"
    )
    .eq("projet_id", projetId)
    .eq("date", date)
    .order("created_at", { ascending: false })
    .returns<
      (Omit<EnvoiJournee, "destinataires" | "auteur"> & {
        createur: { prenom: string | null; nom: string | null } | null;
        envoi_destinataires: EnvoiDestinataire[];
      })[]
    >();
  return (data ?? []).map(({ envoi_destinataires, createur, ...e }) => ({
    ...e,
    auteur: createur ? nomComplet(createur) : null,
    destinataires: envoi_destinataires ?? [],
  }));
}
