import { STATUTS, type BookingStatut } from "@/lib/bookings/types";
import type { Genre } from "@/lib/figurants/types";

// En casting, "Proposé" / "PER (pas encore de réponse)" ne veulent rien
// dire — ce qui compte c'est où en est la personne : rien envoyé, envoyé
// mais pas encore relu par le staff, ou relu et complet. Mêmes valeurs de
// statut que les bookings (partagées en base), juste relabellisées pour ce
// contexte. "À traiter" se met tout seul dès que le candidat a tout envoyé
// (voir finalizeCastingUpload) — jamais "Complet" directement, ça reste un
// choix du staff une fois le contenu relu.
const CASTING_STATUT_OVERRIDES: Partial<Record<BookingStatut, { label: string; tone?: "default" | "coral" | "turquoise" | "yellow" | "danger" }>> = {
  proposé: { label: "Incomplet" },
  envoyé: { label: "À traiter", tone: "yellow" },
  attente_validation: { label: "Complet" },
};

export const CASTING_STATUTS = STATUTS.map((s) => {
  const override = CASTING_STATUT_OVERRIDES[s.value];
  return override ? { ...s, label: override.label, tone: override.tone ?? s.tone } : s;
});

export function castingStatutLabel(v: BookingStatut): string {
  return CASTING_STATUTS.find((s) => s.value === v)?.label ?? v;
}

export type CategorieCachet = "role" | "silhouette" | "doublure";

export const CATEGORIE_CACHET_LABELS: Record<CategorieCachet, string> = {
  role: "Rôle",
  silhouette: "Silhouette",
  doublure: "Doublure",
};

// Mode de casting par défaut du rôle — indicatif seulement : les deux
// façons d'envoyer une sélection (lien selftape par mail, ou planning
// présentiel) restent toujours disponibles depuis la page, pour basculer
// au cas par cas si une personne prévue en présentiel ne peut finalement
// pas se déplacer.
export type CastingMode = "presentiel" | "selftape";

export const CASTING_MODE_LABELS: Record<CastingMode, string> = {
  presentiel: "Présentiel",
  selftape: "Selftape",
};

export type CastingRole = {
  id: string;
  projet_id: string;
  nom: string;
  date_tournage: string | null;
  categorie_cachet: CategorieCachet;
  mode: CastingMode;
  nb_videos: number;
  photo_labels: string[];
  demande_bande_demo: boolean;
  message_corps: string | null;
  visible_partage: boolean;
  pdf_storage_path: string | null;
  pdf_filename: string | null;
  created_at: string;
};

export type CastingEntry = {
  id: string;
  projet_id: string;
  role_id: string;
  figurant_id: string;
  booking_id: string | null;
  candidature_id: string | null;
  request_token: string;
  video_storage_paths: string[];
  requested_at: string;
  submitted_at: string | null;
  statut: BookingStatut;
  mode: CastingMode;
  notes: string | null;
  visible_partage: boolean;
  figurants: {
    prenom: string;
    nom: string;
    email: string | null;
    telephone: string | null;
    genre: Genre | null;
    date_naissance: string | null;
    a_vehicule: boolean | null;
    vehicule_velo: boolean;
    vehicule_moto: boolean;
    vehicule_scooter: boolean;
    compte_myrole: boolean;
    est_comedien: boolean;
    agent_nom: string | null;
    agent_email: string | null;
    agent_telephone: string | null;
    agent_agence: string | null;
  } | null;
};
