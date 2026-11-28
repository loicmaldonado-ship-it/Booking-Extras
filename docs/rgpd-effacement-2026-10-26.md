# Effacement reprenable — 26 octobre 2026

Branche : `tests/integration-main-elea-2026-10-22`. Ce document décrit le lot qui le contient ; le bilan Trello historique doit encore être actualisé.

## Changement

L’ancien enchaînement de suppressions indépendantes pouvait laisser un profil partiellement effacé, avec encore des données dans les historiques et sans indication de reprise. La préparation est désormais une transaction serveur, réservée au propriétaire, qui retire les accès candidat et les jetons, nettoie les champs identifiants et conserve une file durable des médias à supprimer. Les fichiers sont retirés par l’API Storage, par lots de 100. Une seconde transaction refuse de confirmer la fin si un fichier référencé est encore présent. Une interruption laisse un bouton « Reprendre le nettoyage », indépendamment du filtre d’inactivité.

Les champs directs nettoyés comprennent naissance, adresse, code postal, agent et contacts ; les notes/réponses des candidatures, bookings, essayages et castings sont retirées. Les messages liés au profil sont supprimés ; les SMS non envoyés sont annulés et leur contenu retiré. Les coordonnées des représentants sont supprimées et les dossiers mineurs purgés après leurs fichiers. Les historiques structurés de travail restent présents. Les écritures personnelles et dépôts privés tardifs sont bloqués pendant et après l’effacement. Les trois buckets concernés sont les photos, vidéos de casting et pièces mineurs. Un média référencé par plusieurs profils bloque la préparation pour éviter de supprimer le travail d’un autre profil.

La file a RLS et des droits serveur explicites, y compris pour le changement Supabase du 30 octobre. Les fonctions de préparation/finalisation ne sont exécutables ni par anon ni par authenticated. Le propriétaire est vérifié côté application et base. Les rôles et permissions réellement appelants ne proviennent pas des métadonnées modifiables du compte.

## Vérifications réellement exécutées

- `npm test` : 176/176 ; vérifications de refus non-propriétaire, erreurs visibles, stockage en échec sans finalisation.
- `npm run typecheck` : réussi ; `npm run lint` : réussi sans diagnostic ; `npm run build` : réussi.
- `tests/rgpd-transaction-local.sql` : DO réussi, fixtures annulées. Masquage des champs directs et snapshots, messages retirés, historiques de booking/candidature/casting conservés, écriture tardive refusée, présence de fichier bloque la finalisation, plan conservé à la reprise. Droits/RLS et refus d’usurpation du mode nettoyage vérifiés sur la seconde base vierge.
- `node --env-file=.env.local scripts/check-rgpd-local.mjs` : réussi sur base isolée. Anon et assistant refusés ; dépôt avec signature obtenue avant préparation refusé ; API Storage réelle puis finalisation réussies ; autre profil intact ; fixtures nettoyées.
- `scripts/check-private-images-local.mjs` : réussi après adaptation du préfixe de la fixture ; photos privées refusées par le cache public, image publique décodable et optimisée.
- Navigateur : propriétaire connecté, profil fictif récemment modifié visible malgré filtre 3 ans, bouton de reprise visible ; capture jointe. Fixture ensuite finalisée par API et supprimée. L’action irréversible finale n’a pas été cliquée dans le navigateur.
- Reconstruction indépendante : 173 migrations + seed rejouées avec succès dans `booking-recette-vierge-20261026` (port API 28194), sans réinitialiser la base principale de test.
- Conseiller sécurité Supabase local : aucune alerte warn/error.

## Limites à conserver dans le bilan

Cette fonction ne rappelle pas les messages déjà transmis et ne supprime pas les copies déjà téléchargées. Un lien signé déjà délivré peut encore rendre son fichier jusqu’à sa suppression physique si Storage est indisponible : la reprise n’est pas présentée comme un effacement terminé. Les textes et documents partagés au niveau projet/envoi peuvent contenir des mentions libres ; une recherche documentaire métier reste nécessaire, sans suppression aveugle de documents concernant d’autres personnes. Les historiques conservés et mensurations peuvent rester réidentifiants : ne pas présenter ce mécanisme comme une anonymisation juridiquement irréversible validée. La politique de conservation et son point de départ ne sont pas décidés dans les cartes/commentaires lus. Aucun délai automatique n’a été inventé. Les doubles appels concurrents ne sont pas encore soumis à un test de charge spécifique ; les transactions/verrous font échouer et permettent de reprendre en cas de conflit.

Les premières fixtures SQL ont été corrigées pour respecter les exigences compte/ rôle de casting et l’interdiction de supprimer directement Storage. La suppression réelle est vérifiée par API. Les résultats finaux ci-dessus remplacent ces essais incomplets.

## Complément : remplacement d’un fichier existant

La migration suivante étend le trigger Storage à toutes les mises à jour, y compris metadata/version sans modification du nom. Test réel supplémentaire : un même lien signé autorise le remplacement sur le profil actif, puis le refuse après préparation de l’effacement. Un dépôt nouveau obtenu avant effacement est aussi refusé. Suppression et finalisation restent possibles. Résultat : `storage-lock-api.log`, toutes assertions réussies et fixtures nettoyées. Aucun changement TypeScript dans ce complément ; les 179 tests et build précédents restent ceux du code applicatif actuel. La chaîne compte désormais 175 migrations ; son replay complet sera vérifié avec le dossier de recette.
