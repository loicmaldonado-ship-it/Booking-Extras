# BUG-04 — révocation et expiration candidate

La carte BUG-04 est vérifiée sur la base locale isolée, sans email ni SMS réel. Les autres critères SEC-02/07 ne sont pas automatiquement validés par ce contrôle.

## Parcours navigateur réellement effectués

1. Connexion du compte fictif Sacha avec ses identifiants seed : espace personnel visible.
2. Vérification DB de la durée initiale de la session : 7 jours. Expiration forcée de cette seule session récente : accès direct à /compte redirigé vers /compte/connexion. Capture candidate-expired-browser.png.
3. Nouvelle connexion réussie, puis désactivation du seul profil seed candidat via API locale : la session ouverte est refusée au rechargement.
4. Tentative de nouvelle connexion avec le bon mot de passe alors que le compte est désactivé : refus « Email ou mot de passe incorrect. » ; capture candidate-revoked-browser.png.
5. Rétablissement de la valeur initiale acces_compte=true via API locale : nouvelle connexion réussie et espace personnel visible. Déconnexion déclenchée ensuite. Aucun autre profil modifié, aucun mot de passe changé.

## Correction supplémentaire et vérifications de concurrence

Le recontrôle applicatif d’accès fonctionnait déjà, mais une connexion concurrente pouvait créer une session après la suppression indépendante des sessions par l’action de révocation. La nouvelle migration ajoute :

- verrou partagé du profil lors d’une création/modification de session ou lien de connexion ; refus si désactivé, anonymisé ou en cours d’effacement ;
- trigger après désactivation, qui supprime sessions et tous jetons dans la même transaction que le changement du profil ;
- maintien de l’invitation explicite d’une fiche rapide sans compte, nécessaire au parcours métier ;
- fonctions internes sans EXECUTE public/authenticated et search_path vide.

`candidate-revocation-local.sql` : DO réussi. Session et liens retirés ensemble ; session/lien tardifs refusés ; réactivation possible. Une panne volontaire sur la suppression des liens prouve que la valeur d’accès, la session et les deux liens sont tous restaurés par rollback. Toutes les fixtures et le trigger de panne sont annulés à la fin du test.

`check-revocation-concurrency-local.mjs` : 20 courses HTTP réelles entre création de session, création de lien et révocation, avec ordre alterné. Aucun jeton survivant dans les 20 cas. Réactivation puis nouvelle session réussies ; fixture supprimée.

Non-régression : auth-hardening-local.sql, invitation-integration-local.sql, guardians-local.sql, minor-dossiers-local.sql et rgpd-transaction-local.sql ont tous terminé par DO sans erreur après migration. Pas de modification de code applicatif dans ce lot ; les 179 tests Node et le build précédents ne sont pas revendiqués comme une nouvelle exécution. Le premier test de la migration a détecté une référence à un champ absent sur la table sessions ; corrigée par branche explicite avant les tests finaux réussis.

## Portée

BUG-04 peut être marquée terminée et vérifiée pour les quatre critères décrits dans la carte. L’expiration du cookie sur plusieurs appareils, tous parcours de récupération, tous tokens publics et la matrice exhaustive des actions serveur restent des cartes distinctes. Le schéma comporte désormais 176 migrations ; un replay vierge du dernier schéma reste à effectuer avant livraison du paquet de recette.
