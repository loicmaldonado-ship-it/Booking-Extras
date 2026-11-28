# Dossiers mineurs — lot du 26 octobre 2026

Ce lot développe LEG-01/02/03 à partir du commentaire de Mathieu du 19 octobre sur DEC-03. Il ne constitue pas la recette métier finale.

## Fonctionnement développé

- Menu Mineurs / DRIEETS et dossiers rattachés à un seul enfant et un seul projet ; édition des deux représentants par l’équipe autorisée.
- Période, commission, fonction et rémunération prévues ; ajout/retrait de pièces DRIEETS propres au projet pour les moins de 16 ans. Pour les 16–18 ans : autorisations parentales, avec l’exception documentée du second représentant.
- Dépôts PDF/photo privés, limite 10 Mo, liens aléatoires de 256 bits stockés sous forme de hash, expiration à sept jours, quota de 30 dépôts par lien. Chaque représentant a son propre lien. Un dépôt reste « reçu, à vérifier ».
- Vérification explicite par l’équipe, commentaire interne, expiration, remplacement et suppression. La validation est liée à la version exacte du fichier et aux coordonnées affichées ; une ancienne version est refusée.
- Complétude recalculée selon la date du booking, refus DB du booking et de la convocation liée si le dossier requis est incomplet ; invalidation des validations dont les coordonnées ne correspondent plus.
- Partage production limité aux pièces validées encore valables et correspondant aux représentants actuels, sans commentaire interne. URLs de fichiers signées pour 60 secondes ; un lien de partage révoqué ne génère plus de nouveaux téléchargements. Une URL de fichier déjà délivrée peut rester valable jusqu’à ces 60 secondes.
- Dataset préparatoire et pages imprimables DRIEETS/autorisations préremplies. Les champs manquants empêchent la préparation. Le dataset refuse les mélanges entre projets/enfants et limite les bookings à la période.
- Suppression RGPD étendue : révocation des liens, inventaire et purge des fichiers avant effacement du dossier ; une panne bloque la confirmation d’anonymisation. La suppression d’un profil/projet ne peut pas laisser les fichiers d’un dossier sans référence.

## Preuves réellement obtenues

162 tests Node passants, types et compilation réussis ; analyse du code sans erreur. Tests ciblés : sept contrôles d’accès/dépôt, cinq tests du dataset, deux tests de rendu du partage et test de refus RGPD en cas d’échec de purge. Les journaux sont dans `preuves-2026-10-26`.

SQL local : dossier absent/incomplet, pièces supplémentaires, exception parent 2, tranches d’âge, expiration, changement de représentants, ancienne validation, chemins étrangers, quota, liens expirés/révoqués, refus de convocation et suppression laissant des fichiers. Simulation transactionnelle d’une ancienne policy de stockage permissive : le bucket mineur reste inaccessible au public et au rôle staff générique ; la simulation est annulée avec les fixtures.

API réelle : deux PDF fictifs stockés puis vérifiés, booking autorisé, accès directs public/staff générique refusés, téléchargement signé comparé au PDF d’origine, remplacement annulant la validation, ancien fichier effectivement supprimé, refus après expiration et révocation. Les fixtures API sont nettoyées dans le script.

Navigateur : enfant Zoé-Test créé dans la base isolée, dossier ouvert depuis l’interface, dates et représentants enregistrés, deux liens de dépôt distincts, deux dépôts de PDF fictifs, vérification explicite et indicateur complet. Partage production avec deux pièces et sans note interne ; préparation DRIEETS affichant les données du dossier. Captures jointes. Ces documents sont entièrement fictifs et sans valeur légale.

Reconstruction : les 172 migrations et le seed ont été rejoués avec succès dans une seconde base jetable. Les huit tests SQL et les scripts API mineurs/concurrence y passent également. La base du navigateur est distincte et a été préservée.

## Limites et travail restant

La durée de conservation et son point de départ ne sont pas définis dans Trello. Vérification en direct de DEC-03/LEG-02/LEG-05/LEG-06 : le commentaire métier décrit les pièces et les règles d’accès ; LEG-02 demande de définir la durée sans valeur chiffrée. Pas de purge automatique inventée.

Les modèles de préparation restent à comparer aux documents acceptés par la production et la commission ; pagination papier et impression PDF finale non validées. L’envoi automatique du lien aux parents n’est pas développé dans ce lot : création et copie du lien, sans email réel en mode test.

La purge RGPD globale des autres familles de données reste à auditer dans LEG-05. Le scénario de panne du nettoyage est couvert, mais la purge complète depuis l’écran RGPD et sa pagination doivent encore être recettées. Les fusions de profils ou suppressions de projets contenant des pièces sont protégées contre la perte de références ; un transfert/purge ciblé de ces dossiers reste à traiter.

Les bookings déjà existants ne sont pas annulés automatiquement après modification d’une pièce. Les contrôles s’appliquent aux insertions, changements de date/projet/profil/statut et aux convocations liées. L’indicateur du dossier est recalculé. Les profils dont la naissance est inconnue et les corrections de naissance dans tous les ajouts rapides doivent encore être audités ; aucune preuve automatique d’âge n’est revendiquée.

Ce document est un complément au bilan de 86 cartes, qui doit être actualisé à la fin de la mission. Il ne marque pas LEG-01/02/03/05/06 comme intégralement terminées.
