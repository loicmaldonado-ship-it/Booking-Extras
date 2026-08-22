// Déconnexion forcée de l'équipe (chef·fe/assistant·es) au bout d'1h,
// indépendamment du rafraîchissement automatique du token Supabase — sans
// ça une session ouverte reste valide indéfiniment tant que l'onglet tourne.
export const SESSION_STARTED_AT_COOKIE = "session_started_at";
export const SESSION_MAX_AGE_SECONDS = 60 * 60;
