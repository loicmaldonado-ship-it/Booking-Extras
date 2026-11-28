# Reconstruction locale — 27 octobre 2026

Base jetable identifiée : booking-casting-180-20261026, API127.0.0.1:28194. La base principale API27194 n’a pas été réinitialisée. Le CLI2.122.0 a exécuté deux fois `db reset --local --yes`, exit0 à chaque fois, avec 180 migrations puis seed. Aucune réparation manuelle n’a été utilisée pour passer les resets.

Contrôle SQL après le second reset : 180 entrées de migrations, deux comptes équipe, leurs deux profils, projet, annonce, candidature et compte candidat attendus. Auth réelle cheffe et assistante avec le mot de passe du README puis lecture REST du projet réussies. Mot de passe candidat vérifié avec scrypt, son véritable algorithme ; un premier contrôle crypt SQL inadapté a été corrigé sans modifier le seed.

Les contrôles des données se font par SQL et API, Studio étant volontairement absent de la pile de recette. Logs dans preuves-2026-10-27 ; assertion SQL dans tests/seed-local-verification.sql.

La copie propre f028fc1 a été extraite avec git archive, sans configuration personnelle ni dépendances préexistantes. npm ci a réussi. Son lanceur a démarré sa propre base BOOKING_EXTRAS_RECETTE_dde6cb0e3998, API29194. Le site a démarré sur localhost3100 ; connexion cheffe au navigateur réussie, tableau de bord avec le projet et une candidature, puis ouverture de l’annonce avec questions et dates du seed. Capture versionnée. Les secrets de cette copie ont été générés localement ; envois réels désactivés. Windows et double-clic Finder non encore testés.

## Sauvegarde et restauration

Un pg_dump complet de la base fictive (883851 octets) a été restauré dans une autre base vide du même conteneur. Le premier essai avec postgres a échoué sur le paramètre système log_min_messages ; le rôle administrateur Supabase du conteneur a permis la restauration complète, exit0, sans changement de droits ni désactivation de protection. Comparaison identique : 180 migrations, 2 users, 2 profils, 1 projet, 1 candidature, 72 policies, 75 tables publiques avec RLS. La base temporaire de restauration a été supprimée ; dump fictif conservé hors archive à titre de preuve. Ce contrôle ne valide pas encore une sauvegarde de production ni l’upgrade depuis son schéma actuel.

## Plan de retour pour une future migration

Avant production : inventorier le schéma réellement déployé et les migrations manquantes, mesurer leur durée sur copie représentative, puis lister et relire DROP/TRUNCATE/DELETE, changements de types, backfills et contraintes. La production n’a pas été consultée ou modifiée pour ce test. Les migrations anciennes intégrées ne doivent pas être réécrites pour un upgrade.

Pour toute opération risquant de détruire des données : sauvegarde complète et fichiers Storage cohérents, vérification de restauration sur environnement isolé avant exécution. En cas d’échec : interrompre les nouvelles écritures, restaurer dans une copie distincte, vérifier schéma/données/RLS/parcours, puis décider la bascule autorisée. Une migration corrective n’est suffisante que si les données n’ont pas été détruites. Le dump SQL ne sauvegarde pas les octets des objets Storage et aucune restauration complète fichiers+base de production n’est démontrée ici. REL-02 reste donc partielle.
