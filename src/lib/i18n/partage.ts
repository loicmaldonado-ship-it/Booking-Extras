// Traduction FR/EN des pages publiques /partage (trombis, fiches
// mensuration, planning essayages, casting réal) — pour les partager avec
// une production anglophone. L'interface staff reste en français partout
// ailleurs ; seules ces pages exposées en lecture seule sont concernées.
export type Lang = "fr" | "en";

export const DEFAULT_LANG: Lang = "fr";

export function parseLang(raw: string | undefined): Lang {
  return raw === "en" ? "en" : "fr";
}

export function localeFor(lang: Lang): "fr-FR" | "en-US" {
  return lang === "en" ? "en-US" : "fr-FR";
}

const DICT = {
  lien_introuvable: { fr: "Lien introuvable", en: "Link not found" },
  lien_invalide: { fr: "Ce lien de partage n'est plus valide.", en: "This share link is no longer valid." },

  // Index documents
  trombis_fiches_journee: {
    fr: "Trombis et fiches mensuration du {date} — lecture seule.",
    en: "Contact sheet and measurement sheets for {date} — read only.",
  },
  trombis_fiches_par_journee: {
    fr: "Trombis et fiches mensuration par journée — lecture seule.",
    en: "Contact sheet and measurement sheets by day — read only.",
  },
  trombis: { fr: "Trombis", en: "Contact sheet" },
  fiches_mensuration: { fr: "Fiches mensuration", en: "Measurement sheets" },
  aucune_journee: { fr: "Aucune journée pour l'instant.", en: "No day yet." },
  confirme: { fr: "confirmé", en: "confirmed" },
  confirmes: { fr: "confirmés", en: "confirmed" },
  au_total: { fr: "au total", en: "total" },

  // Trombis / fiches toolbar
  telecharger_pdf: { fr: "Télécharger le PDF", en: "Download PDF" },
  generation_pdf: { fr: "Génération...", en: "Generating..." },
  imprimer: { fr: "Imprimer / Enregistrer en PDF", en: "Print / Save as PDF" },
  champs_a_afficher: { fr: "Champs à afficher :", en: "Fields to show:" },
  appliquer: { fr: "Appliquer", en: "Apply" },
  champ_fonction: { fr: "Fonction", en: "Role" },
  champ_telephone: { fr: "Téléphone", en: "Phone" },
  champ_email: { fr: "Email", en: "Email" },
  champ_age: { fr: "Âge", en: "Age" },
  champ_ville: { fr: "Ville", en: "City" },
  champ_genre: { fr: "Genre", en: "Gender" },
  champ_pronom: { fr: "Pronom", en: "Pronoun" },
  ans: { fr: "ans", en: "y/o" },
  aucun_booking_confirme: { fr: "Aucun booking confirmé pour cette journée.", en: "No confirmed booking for this day." },
  heure_non_renseignee: { fr: "Heure non renseignée", en: "Time not set" },
  cachet_non_assigne: { fr: "Cachet non assigné", en: "Rate not assigned" },
  sans_fonction_assignee: { fr: "Sans fonction assignée", en: "No role assigned" },
  cachet_figurant: { fr: "Figurant", en: "Extra" },
  cachet_silhouette: { fr: "Silhouette", en: "Silhouette" },
  cachet_silhouette_parlante: { fr: "Silhouette parlante", en: "Speaking silhouette" },
  cachet_doublure_simple: { fr: "Doublure simple", en: "Simple stand-in" },
  cachet_doublure_polyvalente: { fr: "Doublure polyvalente", en: "Versatile stand-in" },
  cachet_role: { fr: "Rôle", en: "Role" },

  // Mensuration sheet
  hauteur: { fr: "Hauteur", en: "Height" },
  poids: { fr: "Poids", en: "Weight" },
  veste: { fr: "Veste", en: "Jacket" },
  pantalon: { fr: "Pantalon", en: "Trousers" },
  tour_tete: { fr: "Tour de tête", en: "Head" },
  tour_cou: { fr: "Tour de cou", en: "Neck" },
  tour_poitrine: { fr: "Tour de poitrine", en: "Chest" },
  tour_taille: { fr: "Tour de taille", en: "Waist" },
  tour_hanches: { fr: "Tour de hanches", en: "Hips" },
  jambes_ext: { fr: "Jambes ext.", en: "Outseam" },
  jambes_int: { fr: "Jambes int.", en: "Inseam" },
  pointure: { fr: "Pointure", en: "Shoe size" },
  gant: { fr: "Gant", en: "Glove" },
  carrure: { fr: "Carrure", en: "Shoulder width" },
  cachet: { fr: "Cachet", en: "Rate" },
  convocation: { fr: "Convocation", en: "Call time" },
  costume: { fr: "Costume", en: "Costume" },
  autres_dates_bookees: { fr: "Autres dates bookées :", en: "Other booked dates:" },

  // Letterhead
  real: { fr: "Réal.", en: "Dir." },

  // Casting réal
  clique_profil: {
    fr: "Clique un profil pour voir ses photos et lancer sa vidéo.",
    en: "Click a profile to see photos and play their video.",
  },
  aucun_profil_disponible: { fr: "Aucun profil disponible pour l'instant.", en: "No profile available yet." },
  video: { fr: "vidéo", en: "video" },
  videos: { fr: "vidéos", en: "videos" },
  photo: { fr: "photo", en: "photo" },
  photos: { fr: "photos", en: "photos" },

  // Essayages
  planning_essayages_jour: { fr: "Planning des essayages par jour — lecture seule.", en: "Fitting schedule by day — read only." },
  telecharger_planning: { fr: "Télécharger le planning", en: "Download schedule" },
  telecharger_fiches: { fr: "Télécharger les fiches", en: "Download sheets" },
  aucun_essayage: { fr: "Aucun essayage pour l'instant.", en: "No fitting yet." },
  aucun_essayage_confirme_journee: { fr: "Aucun essayage confirmé pour cette journée.", en: "No confirmed fitting for this day." },
  col_photo: { fr: "Photo", en: "Photo" },
  col_figurant: { fr: "Figurant", en: "Extra" },
  col_fonction: { fr: "Fonction", en: "Role" },
  col_cachet: { fr: "Cachet", en: "Rate" },
  col_costume: { fr: "Costume", en: "Costume" },
  col_dates_tournage: { fr: "Dates de tournage", en: "Shooting dates" },
  col_lieu: { fr: "Lieu", en: "Location" },
  col_statut: { fr: "Statut", en: "Status" },
  col_notes: { fr: "Notes", en: "Notes" },
  creneau: { fr: "Créneau", en: "Slot" },
  statut_confirme: { fr: "confirmé", en: "confirmed" },
  statut_fait: { fr: "fait", en: "done" },
  planning_essayage_titre: { fr: "Planning essayage", en: "Fitting schedule" },
  fiches_mensuration_titre: { fr: "Fiches de mensuration", en: "Measurement sheets" },
  retour_planning: { fr: "← Retour au planning", en: "← Back to schedule" },
  retour_journees: { fr: "← Retour aux journées", en: "← Back to days" },
  choisir_journee: { fr: "Choisis une journée depuis le planning.", en: "Choose a day from the schedule." },
  date_a_confirmer: { fr: "Date à confirmer", en: "Date to be confirmed" },
} as const;

export type DictKey = keyof typeof DICT;

export function t(lang: Lang, key: DictKey, vars?: Record<string, string>): string {
  let text: string = DICT[key][lang];
  if (vars) {
    for (const [k, v] of Object.entries(vars)) text = text.replace(`{${k}}`, v);
  }
  return text;
}

const STATUT_KEY: Record<string, DictKey> = {
  confirmé: "statut_confirme",
  fait: "statut_fait",
};

export function tStatut(lang: Lang, statut: string): string {
  const key = STATUT_KEY[statut];
  return key ? t(lang, key) : statut;
}

const CACHET_KEY: Record<string, DictKey> = {
  Figurant: "cachet_figurant",
  Silhouette: "cachet_silhouette",
  "Silhouette parlante": "cachet_silhouette_parlante",
  "Doublure simple": "cachet_doublure_simple",
  "Doublure polyvalente": "cachet_doublure_polyvalente",
  Rôle: "cachet_role",
};

// Traduit une valeur de cachet (venant des bookings, pas du dictionnaire
// figé) — retombe sur la valeur brute si elle ne fait pas partie du barème
// standard (donnée libre plutôt qu'un vrai bug d'affichage).
export function tCachet(lang: Lang, cachet: string | null): string | null {
  if (!cachet) return cachet;
  const key = CACHET_KEY[cachet];
  return key ? t(lang, key) : cachet;
}
