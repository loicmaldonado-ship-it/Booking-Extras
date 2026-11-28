# Installation de recette — preuves et limites

Sources de la copie indépendante vérifiée : commit 6d6dcf5, avec le lot images ensuite committé 5445075 et les lanceurs de recette. Ces tests ne couvrent pas les nouveaux dossiers mineurs ajoutés ensuite ; l’archive finale doit être régénérée et revérifiée.

Le 26 octobre : copie sans .git, .env.local ni node_modules ; démarrage Supabase isolé, installation `npm ci` par le lanceur, création locale de la configuration en mode test, démarrage Next sur 127.0.0.1:3100. Un premier démarrage de la base n’a pas abouti ; sa reprise a réussi. Le lanceur prévoit désormais une seule reprise et un journal d’erreur filtré. Connexion navigateur avec le compte fictif cheffe.test, tableau de bord et Projet de test visibles (capture jointe). Aucun identifiant de production utilisé.

Base jetable séparée booking-recette-vierge-20261026 : historique de 171 migrations appliqué au démarrage, puis `db reset --local` réussi. Après reconstruction : 70 tables publiques, 2 profils, 1 projet, 1 candidature, 0 représentant fictif résiduel. Les 7 tests SQL locaux et les scripts API et concurrence ont passé. Cette pile a ensuite été arrêtée en conservant ses volumes. Ces comptages précèdent l’ajout des quatre tables de dossiers mineurs.

Le README racine est destiné à Loïc et Mathieu ; il indique les comptes fictifs, le mode test, les parcours métier, le signalement des erreurs et les limites. Le lanceur Mac a été exécuté via son programme Node ; sa syntaxe bash est vérifiée. Le double-clic Finder et le lanceur Windows n’ont pas été testés. Aucune archive finale n’est encore déclarée prête.

## Complément après le lot mineurs

Le schéma final du lot 23d59c5 contient 172 migrations et a été reconstruit puis vérifié par huit tests SQL et deux scripts API (voir dossiers-mineurs-2026-10-26.md). L’arrêt de la copie de recette a été exécuté et a conservé ses données. Le lanceur attribue désormais une identité de base différente à chaque version de schéma ; un changement dans un dossier existant est refusé sans réinitialisation. Des fichiers ARRETER-RECETTE sont fournis. Sept tests de protection du lanceur passent sur macOS avec des exécutables simulés, sans accès réseau ni vraie base. Ils vérifient les refus de configuration personnelle, de serveur non local et d’arrêt d’un autre projet, ainsi que le mode test imposé. Ces tests POSIX sont ignorés sous Windows ; aucun test Windows réel n’est revendiqué.

L’archive finale doit toujours être générée et son nouveau lancement doit être vérifié après la fin des changements.
