# Booking Extras — tests métier pour Loïc et Mathieu

Ce dossier sert à essayer la version intégrant `main` et `elea`, sur votre ordinateur et avec des personnes fictives. Il n’est pas relié à la production. Les fonctionnalités non vérifiées et les éléments encore manquants sont indiqués dans le [bilan de toutes les cartes](docs/bilan-trello-2026-10-26.md). La présence d’un écran ne signifie pas que sa recette est terminée.

## 1. Avant le premier essai

Prévoyez une connexion internet, environ 15 Go libres et quelques minutes au premier lancement. Installez **Node.js 22 ou 24** depuis [nodejs.org](https://nodejs.org/) et **Docker Desktop** depuis [docker.com](https://www.docker.com/products/docker-desktop/). Ouvrez Docker Desktop et attendez qu’il indique que son moteur fonctionne. Vous n’avez besoin ni d’un compte Supabase, ni des accès de production, ni d’un logiciel de développement.

Décompressez entièrement l’archive dans un nouveau dossier nommé simplement `Booking-Extras-Recette`, dans Documents. N’ouvrez pas les fichiers à l’intérieur de l’archive ZIP. Chacun utilise sa propre copie : vos modifications ne seront pas visibles chez l’autre personne et ne changent rien au vrai site.

## 2. Ouvrir le site

**Sur Mac :** double-cliquez sur `DEMARRER-RECETTE.command`. Si macOS refuse le fichier, utilisez un clic droit puis Ouvrir ; si votre ordinateur est administré et interdit cette action, transmettez le message à Éléa. Une fenêtre s’ouvre : laissez-la ouverte. À défaut, ouvrez Terminal, tapez `cd `, glissez le dossier décompressé dans la fenêtre, appuyez sur Entrée, puis tapez `node scripts/recette-local.mjs` et appuyez sur Entrée.

**Sur Windows :** double-cliquez sur `DEMARRER-RECETTE.cmd`. Gardez la fenêtre ouverte. Ce lanceur Windows doit encore être vérifié sur un poste Windows ; si une erreur apparaît, transmettez-la à Éléa.

Quand la fenêtre affiche que le site est prêt, ouvrez **[http://localhost:3100](http://localhost:3100)** dans Chrome, Safari ou Firefox. Cette adresse fonctionne uniquement sur l’ordinateur où le programme tourne. Attendez la fin du premier démarrage : les composants de la base doivent être téléchargés.

Pour revenir un autre jour : ouvrez Docker Desktop, puis relancez le même fichier. Vos données fictives sont conservées. Pour arrêter le site : revenez dans la fenêtre et appuyez sur **Ctrl+C**. Vous pouvez ensuite quitter Docker Desktop. Ne supprimez pas ses volumes si vous souhaitez conserver vos essais.

## 3. Se connecter

Le mot de passe de tous ces **comptes fictifs** est `booking-test`.

| Rôle à essayer | Adresse de connexion | Où se connecter |
| --- | --- | --- |
| Cheffe / propriétaire | `cheffe.test@test-chat-charge.fr` | [Connexion équipe](http://localhost:3100/login) |
| Assistante | `assistante.test@test-chat-charge.fr` | [Connexion équipe](http://localhost:3100/login) |
| Candidate Sacha | `candidate.test@test-figurant.fr` | [Connexion candidat](http://localhost:3100/compte/connexion) |

L’équipe dispose d’un projet « Projet de test » avec une annonce et une candidature. Pour ouvrir directement cette annonce : [Annonce de test](http://localhost:3100/postuler/00000000-0000-4000-8000-00000000a0a0). Utilisez une fenêtre privée pour jouer le candidat pendant que vous restez connecté à l’équipe dans votre fenêtre habituelle. Une session équipe expire après une heure : reconnectez-vous si le site revient à l’écran de connexion.

## 4. Essais métier à effectuer

Commencez par le parcours quotidien, puis les exceptions. Utilisez uniquement des identités et des coordonnées inventées, par exemple `essai-loic@example.test`. N’importez pas de vraie pièce d’identité ni de dossier médical.

1. **Projet et annonce** : ouvrez le projet, relisez les informations, modifiez une annonce, ses dates et ses questions. Consultez le résultat côté candidat. Vérifiez surtout les libellés et règles attendus par le métier.
2. **Candidature et profils** : consultez la candidature de Sacha, ses réponses, ses disponibilités et la fiche. Essayez recherche, filtres et classement. Comparez les résultats avec ce que vous venez de saisir.
3. **Préparation du tournage** : ajoutez des dates et des profils de démonstration, essayez réserves, confirmations, listes et changements de date. Vérifiez les compteurs, statuts et informations après rechargement de la page.
4. **Essayages et casting** : essayez les créneaux, les affectations, un changement de créneau et les listes. Signalez un profil placé sur une mauvaise journée ou une information perdue.
5. **Documents et exports** : ouvrez les documents et exports qui vous servent réellement. Relisez noms, dates, regroupements, ordre, présentation et pages imprimées. Les fichiers attendus par votre métier doivent être comparés à vos modèles validés.
6. **Droits et confidentialité** : avec l’assistante et le candidat, vérifiez que chacun ne voit que les informations qui lui sont destinées. Signalez immédiatement toute information appartenant à un autre projet ou à une autre personne.
7. **Mineurs et exceptions** : consultez le bilan avant de tester. Les coordonnées des représentants sont en cours d’intégration ; un dossier DRIEETS complet et une autorisation signée ne sont pas garantis par la seule présence de ces champs.

Les messages internes peuvent être essayés. **Les emails, SMS, notifications externes et lectures Gmail sont bloqués en mode recette** : leur non-réception sur un vrai téléphone est attendue. Cette copie ne permet donc pas de valider la livraison réelle de messages. Ne saisissez aucun mot de passe Gmail, aucune clé de production et aucun véritable destinataire pour tenter de débloquer ces envois.

## 5. Signaler un problème utilement

Pour chaque problème, envoyez à Éléa : **le rôle utilisé**, **la page**, **les étapes faites**, **le résultat attendu**, **le résultat obtenu**, et une capture si possible. Ajoutez l’identifiant de carte Trello si vous le connaissez et le numéro de version indiqué dans `VERSION-RECETTE.txt`. Notez aussi les décisions métier ou les formulations à changer. Le tableau Trello n’est pas modifié automatiquement.

## 6. Si le lancement échoue

- **« Docker… »** : ouvrez Docker Desktop et attendez son démarrage, puis relancez.
- **« node… introuvable »** : installez Node.js 22 ou 24, fermez la fenêtre puis relancez.
- **Page inaccessible** : vérifiez que la fenêtre de lancement reste ouverte et qu’elle a fini son démarrage. Utilisez bien `localhost:3100`, pas l’adresse d’une autre personne.
- **Port déjà utilisé** : fermez votre précédente fenêtre de recette avec Ctrl+C avant de relancer.
- **Configuration personnelle ou schéma différent** : gardez votre dossier actuel et transmettez le message à Éléa. Le lanceur refuse de l’écraser ou de réinitialiser vos essais.
- **Autre message** : faites une capture de la partie qui contient l’erreur. Ne transmettez jamais le contenu de `.env.local` : il contient les clés de votre base locale.

Le bilan des 86 cartes fait foi pour savoir ce qui est démontré, ce qui reste à tester et ce qui empêche encore une mise en production. Votre recette métier complète les tests techniques ; elle ne les remplace pas.
