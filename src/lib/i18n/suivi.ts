// Textes FR/EN de l'identité visiteur, des commentaires et du lien de
// validation MES, sur les pages de partage publiques (bouton FR/EN).
import type { Lang } from "@/lib/i18n/partage";
import { formatDateLong, formatDateShort, formatDayMonth } from "@/lib/format-date";

const DICT = {
  bonjour: { fr: "Bonjour 👋", en: "Hello 👋" },
  pourquoi: {
    fr: "Pour que l'équipe casting sache qui consulte et qui commente :",
    en: "So the casting team knows who is viewing and commenting:",
  },
  avant_ecrire: { fr: "Avant d'écrire, dites-nous qui vous êtes :", en: "Before writing, tell us who you are:" },
  votre_prenom: { fr: "Votre prénom", en: "Your first name" },
  votre_role: { fr: "Votre rôle", en: "Your role" },
  continuer: { fr: "Continuer", en: "Continue" },
  une_fois: { fr: "Demandé une seule fois sur cet appareil.", en: "Asked only once on this device." },
  commentaires: { fr: "Commentaires", en: "Comments" },
  commentaires_titre: { fr: "Commentaires pour l'équipe casting", en: "Comments for the casting team" },
  fermer: { fr: "Fermer", en: "Close" },
  vous: { fr: "Vous", en: "You" },
  pas_moi: { fr: "Ce n'est pas moi", en: "Not me" },
  aucun_commentaire: { fr: "Pas encore de commentaire.", en: "No comments yet." },
  equipe_casting: { fr: "équipe casting", en: "casting team" },
  un_mot: { fr: "Un mot pour l'équipe casting…", en: "A note for the casting team…" },
  envoyer: { fr: "Envoyer", en: "Send" },
  // Lien de validation MES
  lien_validation_introuvable: {
    fr: "Ce lien de validation n'existe pas ou a été supprimé par l'équipe casting.",
    en: "This approval link doesn't exist or was removed by the casting team.",
  },
  apercu: {
    fr: "👀 Aperçu équipe : c'est ce que voit la mise en scène. Les votes et commentaires sont désactivés ici.",
    en: "👀 Team preview: this is what the director sees. Votes and comments are disabled here.",
  },
  consigne: {
    fr: "Touchez une photo pour l'agrandir. Répondez Oui ou Non pour chaque profil : l'équipe casting le voit tout de suite.",
    en: "Tap a photo to enlarge it. Answer Yes or No for each profile: the casting team sees it right away.",
  },
  tous: { fr: "Tous", en: "All" },
  a_voir: { fr: "À voir", en: "To review" },
  oui: { fr: "Oui", en: "Yes" },
  non: { fr: "Non", en: "No" },
  jour: { fr: "Jour", en: "Day" },
  tous_les_jours: { fr: "Tous les jours", en: "All days" },
  sans_jour: { fr: "Sans jour", en: "No day" },
  sans_jour_prevu: { fr: "Sans jour prévu", en: "No day planned" },
  dans_la_journee: { fr: "Dans la journée", en: "Booked for the day" },
  en_cours: { fr: "En cours de choix", en: "Being considered" },
  personne_jour: { fr: "Personne pour ce jour pour l'instant.", en: "Nobody for this day yet." },
  profil: { fr: "profil", en: "profile" },
  profils: { fr: "profils", en: "profiles" },
  ans: { fr: "ans", en: "y/o" },
  prevu_le: { fr: "Prévu·e le", en: "Planned on" },
  dispo_le: { fr: "Dispo le", en: "Available on" },
  agrandir: { fr: "Agrandir les photos de", en: "Enlarge photos of" },
  note: { fr: "Une note sur ce profil (optionnel)", en: "A note about this profile (optional)" },
  aucun_profil: { fr: "Aucun profil ici.", en: "No profiles here." },
  a_propos_tous: { fr: "À propos de : tout le monde", en: "About: everyone" },
  a_propos: { fr: "À propos de :", en: "About:" },
  sur: { fr: "sur", en: "about" },
  photo_prec: { fr: "Photo précédente", en: "Previous photo" },
  photo_suiv: { fr: "Photo suivante", en: "Next photo" },
  taille: { fr: "", en: "" },
  pointure: { fr: "pointure", en: "shoe size" },
  veste: { fr: "veste", en: "jacket" },
  pantalon: { fr: "pantalon", en: "pants" },
  Femme: { fr: "Femme", en: "Woman" },
  Homme: { fr: "Homme", en: "Man" },
  "Non-binaire": { fr: "Non-binaire", en: "Non-binary" },
  Autre: { fr: "Autre", en: "Other" },
} as const;

export type SuiviKey = keyof typeof DICT;

export function ts(lang: Lang, key: SuiviKey): string {
  return DICT[key][lang];
}

// Rôles proposés à l'arrivée (enregistrés tels qu'affichés).
export const ROLES: Record<Lang, string[]> = {
  fr: ["Réalisation", "Mise en scène", "1er assistant·e", "Production", "Costumes", "Autre"],
  en: ["Director", "1st AD", "Production", "Costume", "Casting", "Other"],
};

// Jour de la semaine dans la langue de la page ; la date reste au format
// JJ/MM comme sur les autres pages de partage.
export function dateLongue(date: string, lang: Lang) {
  return formatDateLong(date, lang === "en" ? "en-US" : "fr-FR");
}

export const jourMois = (date: string) => formatDayMonth(date);

export function dateHeure(iso: string, lang: Lang) {
  const heure = new Date(iso).toLocaleTimeString(lang === "en" ? "en-US" : "fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${formatDateShort(iso)} ${heure}`;
}
