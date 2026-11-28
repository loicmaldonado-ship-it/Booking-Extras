# Casting — finalisation et chemins vérifiés, 26–27 octobre 2026

## Défauts reproduits puis corrigés

1. Une question obligatoire sans réponse était refusée après insertion de la photo. Les réponses et la fiche sont désormais validées avant les écritures.
2. Deux finalisations simultanées déclaraient un seul succès mais inséraient deux références photo. Une nouvelle fonction PostgreSQL regroupe désormais photos, fiche, bande démo, réponses, statut et notification dans une seule transaction. Elle verrouille profil, entrée, rôle et objets concernés puis recontrôle le jeton, la clôture et la date limite.
3. Une signature émise avant transmission permettait encore un dépôt physique après transmission. Un trigger Storage refuse les chemins publics d’une entrée transmise/clôturée/hors délai. Les indices sont normalisés : 0.0 et les espaces ne contournent pas ce contrôle.
4. La finalisation directe des photos contrôlait leur présence mais pas leurs pixels. Les images sont téléchargées puis soumises au même décodeur serveur JPEG/PNG/WebP, limite20Mo/40Mpx, avant leur référencement.
5. Les ajouts et retraits vidéo équipe pouvaient recevoir un chemin non associé à leur entrée. Les nouveaux ajouts sont bornés au chemin du slot staff et à un objet existant ; un retrait exige une référence présente dans l’entrée. Un fichier encore référencé ailleurs est conservé. Les ajouts répétés sont idempotents et les libellés restent alignés.

Les ajouts d’équipe après transmission restent possibles : la photo utilise un préfixe staff explicite, y compris pour un libellé ressemblant à un UUID ; le chemin vidéo staff sans indice reste distinct du chemin public. Le rôle avancé a_relancer n’est pas régressé par une soumission.

## Preuves réellement exécutées

- Suite complète **185/185**, types réussis, ESLint sans diagnostic, build réussi. Preuves dans preuves-2026-10-27.
- SQL : rollback volontaire déclenché à la notification, après photo/fiche/bande démo/statut : aucune mutation partielle ; puis sauvegarde complète et second appel refusé. Labels accentués/espaces/barre oblique encodés comme le navigateur. RPC interdite à anon/authenticated ; service seul. Statut avancé conservé.
- Storage SQL : photos/vidéos et remplacement public tardifs refusés ; clôture sans submitted_at et délai passé refusés ; formats staff conservés. Fixtures annulées.
- Script des vraies actions avec Supabase/Storage réels : JPEG et deux MP4 générés par ffmpeg, chemin d’une autre entrée réelle, faux MIME, image tronquée, fichiers absents, fichiers dupliqués, slot dupliqué, nombre excessif et indices ambigus. Tous résultats attendus obtenus. Cinq courses de finalisations : un succès et une photo dans chaque cas. Anciennes signatures photo/vidéo refusées après transmission ; fichier transmis toujours lisible.
- Actions staff exécutées avec base réelle et contrôle de projet instrumenté pour le projet fictif : ajout photo/vidéo après transmission, idempotence, libellés, association/retrait étranger refusés, autre fichier intact et retrait d’une référence partagée sans perte de l’autre référence. Le test ne remplace pas l’audit intégral des permissions de toutes les Server Actions.
- Le 27 octobre, navigateur : formulaire public complet, photo JPEG fictive, réponse oui, envoi réussi ; rechargement « Déjà envoyé » sans formulaire. DB : statut envoyé, une photo, une notification et réponse oui. Fixture ensuite nettoyée. Le sélecteur de fichier a bloqué l’automatisation pendant une longue période : ce temps n’est pas présenté comme du travail accompli.
- Base neuve indépendante booking-casting-180-20261026 : **180 migrations + seed** appliqués ; cinq scénarios SQL (casting, révocation, fusion et suppression) et le script casting complet passent avec ses propres clés locales. Démarrage minimal réussi en excluant les services non utilisés par l’application. Pas de reset de la base principale.
- Conseiller sécurité local : aucune alerte warn/error.

## Portée et limites

BUG-14 et BUG-15 peuvent être terminées et vérifiées pour leurs critères de verrou de soumission et d’association des fichiers. Cela ne valide pas tout MET-07, les codecs/caméras des appareils réels (MED-02), toutes les familles de liens (SEC-05), ni toutes les mutations de l’application (BUG-13).

La transaction concerne les références et données métier ; les fichiers déjà envoyés avant un refus restent des fichiers de préparation jusqu’à reprise/nettoyage. La purge des dépôts abandonnés et les quotas de toutes familles restent à auditer. La révocation d’un jeton avant toute finalisation et tous scénarios de partage ne sont pas validés par ces tests. Le retrait d’un fichier non partagé reste une opération Storage puis DB : la panne entre ces deux services est signalée mais n’est pas encore un nettoyage durable transactionnel. La concurrence de tous les ajouts staff n’est pas couverte. Les essais de lecture/décodage sur véritables iPhone/Android et la validation métier Loïc/Mathieu restent attendus.

Les contrôles complets sont versionnés dans scripts/check-casting-finalization-local.mjs (options --stale-slot --race) et les deux scénarios SQL. Les anciens logs d’échec restent conservés à titre d’historique ; ils ne décrivent plus le résultat courant. Aucun push, déploiement ni message réel envoyé.
