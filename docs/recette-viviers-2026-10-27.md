# Isolation des suggestions et ajouts rapides — 27 octobre 2026

Défauts réellement reproduits avec Auth/REST locaux : un profil non visible par la policy figurants ressortait dans findPossibleDuplicates ; un identifiant privé étranger envoyé dans reprendre:id permettait un booking via le service. Les sentinelles du test ont échoué avant correction. Fixtures et bookings supprimés après chaque essai ; aucune invitation réelle.

Les deux recherches de doublons utilisent désormais le client de la session et la RLS, y compris la fiche source. Les quatre recherches de profils de l’ajout rapide (email, téléphone, choix id, relecture fiche) utilisent aussi ce client. Les opérations administratives nécessaires sont conservées après ces contrôles.

Le script scripts/check-private-duplicates-local.mjs exécute les vrais modules compilés avec client admin local et client Auth assistant réel. Il fournit six profils fictifs : partagé, privé autre projet, comédien autre pool, privé projet courant, second partagé, comédien pool courant. La RLS de référence est contrôlée avant les suggestions. Après correction : aucun profil étranger dans les doublons ; profils locaux/partagés et comédien du pool conservés pour la recherche correspondante ; exclusion des comédiens conservée pour l’ajout rapide ; source invisible ne renvoie rien. Reprise forgée refusée sans booking ni invitation ; profil privé du projet courant accepté. Photos non utilisées dans cette épreuve, résolution photo remplacée par une map vide ; transport invitation remplacé par un compteur. Auth, requêtes et écritures métier sont réels.

186/186 tests Node, types, ESLint et build réussis. Trois tests d’âge ont nécessité d’ajouter le client de session au banc d’essai ; leurs critères et assertions d’âge sont conservés.

BUG-03/SEC-04/BUG-02 restent partiels : autres pickers, exports et actions à vérifier. Un test SQL additionnel a également reproduit la création directe d’un booking vers un profil caché ; sa protection plus générale est le lot suivant. Cette preuve ne signifie pas que l’audit global des viviers est terminé.
