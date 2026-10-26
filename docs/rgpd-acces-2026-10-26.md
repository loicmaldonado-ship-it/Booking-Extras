# Accès RGPD — correction du 26 octobre 2026

La lecture globale des profils inactifs et la page RGPD étaient moins restrictives que l’action d’anonymisation, déjà réservée au propriétaire. La page et le helper serveur exigent désormais tous deux un compte propriétaire de rôle chef avant toute lecture privilégiée. Le menu et le tableau de bord ne proposent plus cette rubrique aux autres comptes. Le helper est marqué server-only.

Le bouton vérifie le résultat réel du nettoyage : une erreur ou interruption reste visible et ne déclenche pas un rafraîchissement présenté comme une réussite.

Vérifications : onze tests ciblés de sécurité et de comportement, types et ESLint OK. Dans le navigateur local : page accessible au compte propriétaire fictif, accès direct refusé (404) au compte assistant fictif, sans coordonnées globales rendues. Capture jointe.

La purge complète des données liées reste un chantier distinct : l’ancien traitement ne nettoie pas encore tous les textes/messages et médias de casting. Le bilan LEG-05 doit conserver cette limite tant que ce traitement n’a pas été développé et vérifié.
