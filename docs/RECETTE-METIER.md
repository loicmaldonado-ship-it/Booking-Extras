# Recette métier — Booking Extras

Pour **Loïc et Mathieu**. Ce document vous guide pour vérifier, avec vos yeux de métier, que le site fait bien ce que
vous attendez avant la mise en ligne. Pas besoin de connaissances techniques.

La partie technique a déjà été vérifiée par des tests automatiques (sécurité entre équipes, connexions, envois de
fichiers, erreurs, affichage sur mobile, navigateurs Chrome, Safari et Firefox simulés). **Ce qui reste, c'est votre
regard** : les bons mots, les bons montants, les bons documents, le bon déroulé de vos journées réelles.

---

## 1. Avant de commencer

| Quoi | Détail |
|---|---|
| **Où** | Sur la **préproduction** (copie du site, séparée de la production) : adresse à fournir par Éléa/Loïc (carte REL-01). **Jamais sur le vrai site.** |
| **Avec quelles données** | Uniquement des **personnes fictives** (ex. « Lou Test »), des emails à vous (ou `prenom+test1@gmail.com`). Aucun vrai figurant. |
| **Appareils** | Un ordinateur **et** un téléphone : un iPhone (Safari) et, si possible, un Android (Chrome). |
| **Comptes** | Une cheffe (propriétaire), une seconde cheffe d'une **autre équipe**, une assistante, deux candidates fictives. |
| **Durée** | Environ 2 demi-journées à deux. Vous pouvez faire les parcours dans le désordre. |

### Comment signaler un problème
Créez une carte Trello dans la liste « 10 - Bug » avec :
1. **Où** : la page (copiez l'adresse) et l'appareil (ex. iPhone 13, Safari).
2. **Ce que vous avez fait** : les étapes, dans l'ordre.
3. **Ce que vous attendiez** / **ce qui s'est passé**.
4. Une **capture d'écran** si possible.

Pour chaque étape ci-dessous : cochez ✅ si c'est bon, ❌ + carte Trello sinon, ❓ si c'est une question de règle métier.

---

## 2. Parcours à jouer

### Parcours A — Projet (carte MET-01)
- [ ] Créer un projet (nom, type, convention, lieu, société de production, indemnités).
- [ ] Le modifier, ajouter une indemnité.
- [ ] **Seule la cheffe qui a créé le projet** peut l'archiver : vérifier qu'une assistante ne le peut pas.
- [ ] Archiver : le projet reste consultable. Le désarchiver.
- [ ] ❓ Un lien de partage d'un projet archivé reste ouvert : est-ce voulu ?

### Parcours B — Annonce (MET-02)
- [ ] Créer une annonce : dates, questions, visuel, limite de candidatures, ouverte ou non aux moins de 16 ans, bande démo obligatoire ou non, types de cachet.
- [ ] L'ouvrir : elle apparaît sur l'accueil public. La fermer : elle disparaît et on ne peut plus postuler.
- [ ] **Scanner le QR code** avec un téléphone : il ouvre bien la bonne annonce.
- [ ] Télécharger l'**affiche** (format standard et story) : rendu, couleurs, texte, lisibilité une fois imprimée.

### Parcours C — Candidater comme une candidate, sur téléphone (CAN-05, LEG-04, MED-01)
- [ ] Ouvrir le lien de l'annonce sur iPhone, remplir tout le formulaire, **prendre les 3 photos avec l'appareil photo**.
- [ ] Oublier une question / une date / la bande démo : un message clair s'affiche.
- [ ] Les photos envoyées sont nettes et **dans le bon sens** (portrait reste portrait).
- [ ] Essayer une **photo iPhone HEIC** (réglage par défaut des iPhone) : elle passe.
- [ ] Candidater avec une date de naissance de moins de 16 ans sur une annonce fermée aux mineurs : refus clair.
- [ ] Atteindre la limite de candidatures : la candidature suivante est refusée.

### Parcours D — Espace personnel de la candidate (CAN-06, CAN-07, CAN-09)
- [ ] Se connecter (mot de passe), se déconnecter, « mot de passe oublié » : l'email arrive et le lien fonctionne une seule fois.
- [ ] Voir ses candidatures et bookings **du bon projet**, ses photos, ses indisponibilités.
- [ ] Recevoir une convocation dans l'espace et cliquer « Bien reçu ».
- [ ] Changer son mot de passe depuis son espace (bloc « Mot de passe »).
- [ ] ❓ Notifications push : à tester sur iPhone **après avoir ajouté le site à l'écran d'accueil** (sinon Safari ne les propose pas) — carte COM-03.

### Parcours E — Tri des candidatures (MET-03)
- [ ] Ranger des candidatures dans des onglets, étiquettes, statuts ; retrouver vite une personne.
- [ ] Export XLSX des candidatures (réservé à la propriétaire) : colonnes et contenu attendus.

### Parcours F — Booking et journée de tournage (MET-04, MET-05, COM-01, COM-04)
- [ ] Passer une candidate en booking, sur une puis deux dates ; changer de date ; retirer.
- [ ] Préparer une journée : besoins, heures, lieux, covoiturage.
- [ ] **Configurer la boîte Gmail d'envoi** (page Équipe) puis envoyer les convocations : l'email arrive, avec le bon texte, la bonne date et la bonne signature.
- [ ] Sans boîte configurée : un message clair dit que l'email n'est pas parti (le message reste dans l'espace candidate).
- [ ] Relire **tous les modèles de messages** et les signatures.

### Parcours G — Documents et exports (MET-08, MET-09)
- [ ] Ouvrir et **imprimer** : planning, bordereau, liste d'appel, trombinoscopes, fiches, covoiturage, silhouettes.
- [ ] Télécharger : export Myrole, vCards, XLSX bookings, liste artistique.
- [ ] **Barème** (désormais un barème par équipe) : vérifier les montants de cachets et majorations ; modifier un montant et le retrouver au bordereau (arrondi à l'euro).
- [ ] Appliquer une indemnité et la retrouver au bordereau.
- [ ] ❓ Les montants et calculs correspondent-ils à vos règles (conventions Cinéma / Audiovisuelle) ?

### Parcours H — Essayages (MET-06)
- [ ] Créer une journée d'essayage, créneaux, lieu ; affecter des personnes ; envoyer un message ; partager le planning.

### Parcours I — Casting et selftapes (MET-07, MED-02, MED-03)
- [ ] Créer un rôle (mode, cachet, date limite, PDF) ; ajouter des profils.
- [ ] La candidate envoie un **selftape depuis son iPhone** (vidéo réelle de 1 à 3 minutes, avec le son) : progression, puis vidéo lisible côté équipe, son synchronisé.
- [ ] Annuler un envoi en cours : rien n'est enregistré.
- [ ] Casting présentiel, distribution, liste artistique, partage.
- [ ] ❓ Taille maximale d'une vidéo : le site accepte 2 Go, Loïc avait parlé de 500 Mo — à trancher.

### Parcours J — Équipe et assistante (MET-10)
- [ ] Inviter une assistante (l'email arrive), limiter ses sections : elle ne voit que ce qui est autorisé.
- [ ] Révoquer son accès : elle perd l'accès immédiatement.
- [ ] Avec la **cheffe d'une autre équipe** : elle ne voit **aucun** projet, profil, document ou export de votre équipe.

### Parcours K — Pages de partage publiques (MET-11)
- [ ] Ouvrir chaque lien de partage en **navigation privée** sur téléphone : contenu attendu seulement (pas de coordonnées si « sans contacts »), lisible.
- [ ] Révoquer un lien : il ne s'ouvre plus.

### Parcours L — Mineurs et DRIEETS (LEG-01, LEG-02, LEG-03)
- [ ] Une candidate de 12 ans postule (annonce ouverte aux mineurs) avec ses **deux représentants légaux**.
- [ ] Créer son dossier mineur : dates de tournage, date de commission, fonction, rémunération, pièces demandées.
- [ ] Envoyer le **lien de dépôt** au parent : il dépose l'autorisation signée (PDF ou photo) depuis son téléphone.
- [ ] Valider la pièce ; vérifier qu'un mineur **ne peut pas être booké tant que le dossier est incomplet**.
- [ ] Générer la **préparation du dossier DRIEETS** : comparer avec un vrai dossier attendu par la DRIEETS.
- [ ] Lien de partage pour la production : il montre le dossier validé ; le révoquer.

### Parcours M — RGPD (LEG-05, LEG-06)
- [ ] Anonymiser un profil fictif (compte propriétaire) : il ne reste plus ni nom, ni email, ni photos.
- [ ] Relire les pages **Confidentialité**, **RGPD** et contacts : elles décrivent le fonctionnement réel (idéalement avec un conseil juridique).

### Parcours N — Téléphone et confort (QA-06, QA-07)
- [ ] Faire les parcours C, D, F et I **entièrement sur téléphone**, en petit écran.
- [ ] Rien ne déborde, tous les boutons sont atteignables. Les grands tableaux défilent horizontalement : ❓ est-ce suffisant, ou faut-il une présentation en cartes sur mobile (BUG-17) ?
- [ ] Ajouter le site à l'écran d'accueil du téléphone : l'icône et le nom s'affichent.

---

## 3. Décisions qui vous attendent

| Sujet | Question | Carte |
|---|---|---|
| Taille des vidéos | 2 Go (actuel) ou 500 Mo ? | MED-02 |
| Photos PNG transparentes | Converties en JPEG (la transparence devient un fond) : acceptable ? | MED-01 |
| Liens de partage d'un projet archivé | Restent ouverts : voulu ? | MET-01 |
| Tableaux sur mobile | Défilement horizontal suffisant, ou présentation en cartes ? | BUG-17 |
| Suivi des erreurs | Journal Vercel gratuit en place ; Sentry (outil dédié) plus tard ? | QA-08 |
| Archivage | Compresser les projets archivés pour gagner de la place ? | MET-01 |
| Mail support | Quelle boîte envoie les invitations des nouvelles cheffes ? | COM-05 |
| Abonnement, administration, signature électronique | Hors de cette recette (A&A-01, RV2-1/2/3) | — |

---

## 4. Fin de recette (carte REL-03)

- [ ] Tous les parcours sont ✅, ou leurs ❌ ont une carte Trello traitée.
- [ ] Les ❓ ont reçu une décision, notée dans la carte concernée.
- [ ] Loïc et Mathieu donnent leur accord écrit (commentaire sur REL-03) pour la mise en production (procédure :
      `docs/mise-en-production.md`).

| Date | Recette faite par | Résultat | Commentaire |
|---|---|---|---|
| | | | |
