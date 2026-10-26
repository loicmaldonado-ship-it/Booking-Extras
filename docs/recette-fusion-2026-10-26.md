# BUG-12 — fusion transactionnelle réellement vérifiée

Le premier test SQL a révélé une incompatibilité de la fusion générique avec la règle compte obligatoire : elle déplaçait les candidatures avant le compte candidat. La correction crée une nouvelle migration, sans modifier l’ancienne. Le compte est transféré avant ses candidatures, puis les autres références sont reprises dans la même transaction. Deux comptes existants restent un conflit explicite, aucun mot de passe n’est écrasé. Les anciennes sessions et liens des deux profils sont révoqués ; une reconnexion est requise après fusion. Les fonctions vérifient toujours le propriétaire via l’identité de la requête.

La fusion automatique de fiches portant des représentants/dossiers légaux est refusée avec un message explicite : les deux fiches sont conservées pour revue d’identité/pièces. Cela évite de rattacher silencieusement des autorisations signées à une autre identité. Ce refus sécurisé reste une limite du parcours global CAN-03, et ne doit pas être décrit comme une fusion complète des mineurs.

## Vérifications exécutées

- `tests/merge-profiles-local.sql` : DO réussi ; toutes les fixtures annulées. Profil source avec compte, candidature, booking rattaché à cette candidature, photo, message, lien et session/jeton : transfert réussi et suppression de la source ; anciennes sessions/liens absents. Aucun fichier Storage réel n’a été créé par ce test SQL : il vérifie le rattachement de sa référence photo.
- Panne volontaire lors du transfert photo, après déplacement du compte/candidature/booking : rollback complet prouvé par les assertions. Les deux profils, le compte source, les relations et les anciens jetons restent dans leur état initial.
- Deux comptes et candidatures en conflit : refus, profils et données conservés. Données légales : refus sans déplacement du dossier.
- `scripts/check-merge-concurrency-local.mjs` : API authentifiée réelle, assistante refusée dans cinq cas ; cinq courses de fusion inversée, exactement un succès et un refus Profil introuvable, un profil et ses deux liens conservés. Seules les fixtures et sessions du script ont été supprimées ; signOut scope local.
- Conseiller sécurité Supabase local : aucune alerte warn/error. Aucun changement de code applicatif ; la suite précédente reste 179 tests Node, sans prétendre à une nouvelle exécution.

BUG-12 peut être terminée et vérifiée pour ses exigences transactionnelles. CAN-03 reste partielle : revue des homonymes/jumeaux/téléphones familiaux, choix d’identité et cas légaux non automatiquement fusionnables. L’interface de confirmation de fusion n’a pas été recliquée dans ce lot ; c’est le vrai RPC utilisé par l’application qui a été exercé via SQL et HTTP. L’affichage des erreurs de conflit reste à recetter séparément.

Schéma : 177 migrations ; replay du dernier ensemble à effectuer avant livraison de la recette.
