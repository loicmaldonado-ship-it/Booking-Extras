# Booking Extras TEST

Application web de gestion de casting, candidatures, figurants, bookings, essayages et documents de production.

- **Site de production :** https://booking-extras.vercel.app
- **Dépôt GitHub :** https://github.com/loicmaldonado-ship-it/Booking-Extras
- **Stack principale :** Next.js 16, React 19, TypeScript, Supabase, Tailwind CSS
- **Déploiement :** Vercel
- **Base / Auth / Storage :** Supabase

> ⚠️ Le projet possède une base Supabase locale complète avec migrations et données de test.  
> Toujours travailler et valider en local avant toute intervention sur la production.

---

## 1. À quoi sert Booking Extras ?

Booking Extras centralise le travail d'une équipe de casting / figuration.

L'application couvre notamment :

- gestion des projets ;
- création et publication d'annonces ;
- réception et tri des candidatures ;
- gestion des fiches figurants / comédiens ;
- disponibilités et jours de tournage ;
- bookings et convocations ;
- essayages ;
- casting à distance et en présentiel ;
- photos, bandes démo et vidéos de casting ;
- documents de production ;
- exports Excel ;
- liens de partage ;
- messagerie et notifications ;
- gestion d'une équipe et des droits d'accès ;
- anonymisation RGPD.

Le projet est déjà largement fonctionnel : une reprise doit donc commencer par **comprendre, tester et sécuriser l'existant** avant d'ajouter de nouvelles fonctionnalités.

---

# 2. Prérequis

Sur le Mac de développement :

- Git
- Node.js + npm
- Docker Desktop
- Supabase CLI utilisable via `npx`
- un navigateur moderne
- Sublime Merge recommandé pour l'interface Git

Vérifier rapidement :

```bash
git --version
node --version
npm --version
docker --version
```

Docker Desktop doit être **lancé** avant Supabase.

---

# 3. Récupérer le projet

```bash
git clone https://github.com/loicmaldonado-ship-it/Booking-Extras.git
cd Booking-Extras
npm install
```

Ne pas développer directement sur `main`.

Créer une branche de travail :

```bash
git switch -c feat/nom-de-la-tache
```

Exemples :

```text
feat/securisation-candidatures
fix/booking-date
test/rls-equipes
docs/readme
```

---

# 4. Lancer Supabase en local

Depuis la racine du projet :

```bash
npx supabase start
```

Pour afficher les informations de la base locale :

```bash
npx supabase status -o env
```

Supabase local utilise notamment :

```text
API : http://127.0.0.1:54321
DB  : port 54322
```

Les autres URL utiles, notamment Supabase Studio, sont affichées par :

```bash
npx supabase status
```

---

# 5. Configurer `.env.local`

Le projet fournit déjà :

```text
.env.example
```

Créer le fichier local :

```bash
cp .env.example .env.local
```

Puis récupérer les clés locales :

```bash
npx supabase status -o env
```

Reporter les valeurs dans `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321

# valeur ANON_KEY de Supabase local
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# valeur SERVICE_ROLE_KEY de Supabase local
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Créer ensuite une clé locale pour le chiffrement des identifiants Gmail :

```bash
openssl rand -base64 32
```

La placer dans :

```env
SECRETS_ENCRYPTION_KEY=
```

Pour tester les notifications push, générer une paire VAPID :

```bash
npx web-push generate-vapid-keys
```

Puis renseigner :

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:test@example.com
```

En local, laisser les identifiants Gmail vides :

```env
GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=
```

Cela évite d'envoyer accidentellement de vrais emails pendant les tests.

> 🔐 Ne jamais recopier les secrets de production dans `.env.local`.  
> Les vraies variables de production vivent dans Vercel.

---

# 6. Initialiser / réinitialiser la base locale

Le schéma est construit depuis :

```text
supabase/migrations/
```

Les données de démonstration sont définies dans :

```text
supabase/seed.sql
```

Pour reconstruire entièrement la base locale :

```bash
npx supabase db reset
```

Cette commande :

1. recrée la base locale ;
2. applique toutes les migrations ;
3. charge `supabase/seed.sql`.

Le seed est **uniquement destiné au local**.

Il n'est pas exécuté par un déploiement de production classique.

---

# 7. Comptes de test locaux

Après :

```bash
npx supabase db reset
```

les comptes suivants existent.

## Équipe

Connexion :

```text
http://localhost:3000/login
```

### Cheffe de test

```text
Email : cheffe.test@test-chat-charge.fr
Mot de passe : booking-test
```

Compte propriétaire du projet de test.

### Assistante de test

```text
Email : assistante.test@test-chat-charge.fr
Mot de passe : booking-test
```

Elle est invitée sur le projet de test.

---

## Candidate existante

Connexion :

```text
http://localhost:3000/compte/connexion
```

```text
Email : candidate.test@test-figurant.fr
Mot de passe : booking-test
```

Cette candidate possède déjà une candidature sur l'annonce de test.

---

## Nouvelle candidature

Un lien public de candidature est également créé par le seed :

```text
http://localhost:3000/postuler/00000000-0000-4000-8000-00000000a0a0
```

Utiliser une nouvelle adresse email pour tester le parcours d'une candidate inconnue.

---

# 8. Lancer l'application

Une fois Supabase lancé, `.env.local` configuré et la base initialisée :

```bash
npm run dev
```

Puis ouvrir :

```text
http://localhost:3000
```

---

# 9. Commandes utiles

## Développement

```bash
npm run dev
```

## Vérification ESLint

```bash
npm run lint
```

## Build de production local

```bash
npm run build
```

Un ticket n'est pas considéré terminé uniquement parce que l'écran fonctionne en développement.

Avant une PR importante :

```bash
npm run lint
npm run build
```

---

## Supabase

Démarrer :

```bash
npx supabase start
```

Arrêter :

```bash
npx supabase stop
```

Voir l'état :

```bash
npx supabase status
```

Réinitialiser la base + migrations + seed :

```bash
npx supabase db reset
```

---

# 10. Architecture du projet

## Application / routes

```text
src/app/
```

Routes principales :

```text
/admin
/annonces
/bookings
/candidatures
/casting
/compte
/equipe
/essayages
/figurants
/mon-compte
/partage
/postuler
/projets
/rgpd
```

Next.js utilise ici l'App Router.

---

## Composants React

```text
src/components/
```

Le classement suit globalement les fonctionnalités :

```text
components/annonces/
components/bookings/
components/candidatures/
components/casting/
components/essayages/
components/figurants/
components/projets/
components/documents/
components/equipe/
```

---

## Logique métier et accès aux données

```text
src/lib/
```

C'est généralement ici qu'il faut commencer lorsqu'un ticket touche à une règle métier.

Exemples :

```text
src/lib/annonces/
src/lib/auth/
src/lib/bookings/
src/lib/candidatures/
src/lib/casting/
src/lib/documents/
src/lib/email/
src/lib/essayages/
src/lib/figurants/
src/lib/notifications/
src/lib/partage/
src/lib/projets/
src/lib/rgpd/
src/lib/supabase/
```

Les Server Actions sont souvent regroupées dans :

```text
actions.ts
```

---

# 11. Supabase

## Migrations

Toutes les évolutions de structure de base doivent passer par :

```text
supabase/migrations/
```

Ne pas modifier uniquement la base locale depuis Supabase Studio en pensant que la modification sera conservée.

Une modification de schéma doit être reproductible après :

```bash
npx supabase db reset
```

---

## Sécurité / RLS

Le projet contient plusieurs règles de Row Level Security importantes.

En particulier :

- isolation entre cheffes / équipes ;
- accès aux projets via `projet_membres` ;
- isolation de certains pools de comédiens ;
- isolation des notifications ;
- contrôle des liens de partage ;
- accès aux données de candidature / booking / casting.

Une vérification côté React **ne remplace jamais** une règle de sécurité en base.

Pour tout ticket concernant l'accès aux données :

1. vérifier la logique applicative ;
2. vérifier les policies RLS ;
3. tester avec au moins deux comptes différents ;
4. essayer volontairement d'accéder à une ressource qui ne doit pas être visible.

---

# 12. Authentification : deux espaces différents

Le projet possède deux mécanismes à ne pas confondre.

## Équipe

Les cheffes et assistants utilisent Supabase Auth.

Entrée principale :

```text
/login
```

Fichiers utiles :

```text
src/lib/auth/
src/middleware.ts
```

---

## Candidats / figurants

L'espace candidat possède son propre système de session.

Entrée :

```text
/compte/connexion
```

Fichiers importants :

```text
src/lib/candidats/password.ts
src/lib/candidats/session.ts
src/lib/candidats/actions.ts
```

Le mot de passe candidat est hashé avec `scrypt`.

Ne pas mélanger une session candidate avec une session Supabase Auth de l'équipe.

---

# 13. Candidatures → Booking

C'est un parcours métier critique.

Une candidature n'est pas un booking.

Une candidate peut être indiquée comme prévue sur un ou plusieurs jours via :

```text
candidature_jours
```

La création réelle du booking intervient ensuite.

Fichiers importants :

```text
src/lib/candidatures/actions.ts
src/lib/candidatures/jours.ts
src/lib/bookings/actions.ts
src/lib/bookings/journees.ts
```

Règle existante importante :

> Une candidature déjà envoyée en booking ne doit pas réapparaître dans la liste principale de la même annonce.

En cas de modification de ce parcours, tester au minimum :

- une annonce à une date ;
- une annonce à plusieurs dates ;
- une candidate disponible sur plusieurs jours ;
- booking d'un seul jour ;
- changement de jour ;
- retrait / suppression ;
- absence de doublon ;
- conservation des autres jours prévus.

---

# 14. Photos et vidéos

Les médias ne sont pas envoyés naïvement.

Le projet possède déjà une logique de compression.

Photos :

```text
src/lib/media/compress-image.ts
```

Vidéos :

```text
src/lib/media/compress-video.ts
src/lib/media/webcodecs-compress-video.ts
src/lib/media/compress-and-upload-video.ts
```

Le traitement vidéo contient notamment :

- compression WebCodecs lorsque disponible ;
- fallback MediaRecorder ;
- traitement spécifique Safari ;
- limite de taille ;
- progression ;
- annulation ;
- timeouts / garde-fous.

Ne pas réécrire cette logique dans un composant.

Réutiliser :

```text
compressAndUploadVideo(...)
```

lorsqu'un nouveau parcours doit uploader une vidéo.

Tester idéalement sur :

- Chrome desktop ;
- Safari desktop ;
- iPhone / Safari mobile ;
- fichier court ;
- fichier lourd ;
- annulation pendant la compression.

---

# 15. Emails

L'envoi utilise Nodemailer / Gmail SMTP.

Fichier principal :

```text
src/lib/email/send.ts
```

Résolution des identifiants par projet :

```text
src/lib/projets/email.ts
```

Modèles :

```text
src/lib/projets/email-templates.ts
```

Signature :

```text
src/lib/projets/signature.ts
```

En local, conserver :

```env
GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=
```

tant qu'un test d'envoi réel n'est pas explicitement nécessaire.

---

# 16. Notifications

Notifications internes :

```text
src/lib/notifications/
```

Web Push :

```text
src/lib/push/
```

La séparation par équipe / projet est importante.

Tester qu'un événement d'une équipe n'apparaisse pas chez une autre équipe.

---

# 17. Documents et exports

Documents de production :

```text
src/app/bookings/documents/
src/components/documents/
src/lib/documents/
```

Le projet sait notamment produire / préparer :

- fiches ;
- trombinoscopes ;
- liste d'appel ;
- covoiturage ;
- bordereau ;
- silhouettes ;
- vCards.

Exports XLSX :

```text
src/lib/export/xlsx.ts
```

Génération PDF côté interface :

```text
src/components/documents/download-pdf-button.tsx
```

avec notamment `html2canvas-pro` et `jspdf`.

Tester les documents avec de vraies données longues et plusieurs figurants, pas uniquement avec une fiche minimale.

---

# 18. Casting

Fonctionnalités principales :

```text
src/app/casting/
src/components/casting/
src/lib/casting/
```

Casting présentiel :

```text
src/app/casting/presentiel/
src/components/casting-presentiel/
src/lib/casting-presentiel/
```

Upload candidat :

```text
src/app/casting/upload/[token]
src/lib/casting/upload-actions.ts
```

Le projet prend notamment en compte :

- rôles ;
- statuts ;
- ordre ;
- dates limites ;
- documents PDF ;
- photos ;
- vidéos ;
- visibilité dans les liens de partage ;
- casting en présentiel.

---

# 19. Essayages

Routes :

```text
src/app/essayages/
```

Logique :

```text
src/lib/essayages/
```

Composants :

```text
src/components/essayages/
```

Vérifier systématiquement le lien :

```text
essayage → projet → figurant → journée / créneau
```

ainsi que les droits d'accès au projet.

---

# 20. RGPD

L'application permet l'anonymisation d'un figurant.

Fichier principal :

```text
src/lib/rgpd/actions.ts
```

L'anonymisation supprime notamment les photos du Storage puis remplace les données personnelles concernées.

Une modification RGPD doit être testée sur une copie locale.

Ne jamais utiliser une vraie personne en production pour vérifier ce comportement.

---

# 21. Travail avec Git et Sublime Merge

Sublime Merge est une interface graphique pour Git.

Le dépôt reste un dépôt Git normal : toutes les opérations visibles dans Sublime Merge correspondent à des opérations Git.

## Ouvrir le projet

Dans Sublime Merge :

```text
File → Open Repository…
```

Choisir le dossier :

```text
Booking-Extras
```

---

## Avant de commencer une carte Trello

1. ouvrir Sublime Merge ;
2. sélectionner `main` ;
3. faire un Pull si nécessaire ;
4. créer une nouvelle branche depuis `main` ;
5. travailler uniquement sur cette branche.

Exemple :

```text
fix/securiser-session-candidate
```

---

## Pendant le développement

Faire des commits petits et compréhensibles.

Exemples :

```text
fix: sécurise la récupération de session candidat
test: couvre accès candidat expiré
docs: documente environnement local
```

Éviter un seul commit géant regroupant plusieurs cartes Trello sans rapport.

---

## Avant Push / Pull Request

Vérifier :

```bash
npm run lint
npm run build
```

Puis :

1. vérifier les fichiers modifiés dans Sublime Merge ;
2. vérifier qu'aucun `.env.local` ou secret n'est inclus ;
3. Push de la branche ;
4. ouvrir une Pull Request ;
5. ne fusionner dans `main` qu'après validation.

---

# 22. Règle de travail recommandée

Pour chaque carte Trello :

```text
1 carte
   ↓
1 branche dédiée
   ↓
développement
   ↓
test local
   ↓
lint + build
   ↓
commit(s)
   ↓
push
   ↓
Pull Request
   ↓
recette
   ↓
merge dans main
```

Lorsqu'une carte modifie la base de données :

```text
carte
 ↓
nouvelle migration
 ↓
npx supabase db reset
 ↓
vérification seed + application
 ↓
tests multi-comptes si sécurité concernée
 ↓
PR
```

---

# 23. Ce qu'il ne faut pas faire

Ne pas :

- développer directement sur `main` ;
- utiliser les secrets de production en local ;
- modifier une table uniquement dans Supabase Studio sans migration ;
- contourner RLS avec le `service_role` pour résoudre un problème d'accès ;
- pousser `.env.local` ;
- tester un mécanisme destructif sur la production ;
- dupliquer la logique de compression vidéo ;
- considérer qu'un écran fonctionnel suffit si `npm run build` échoue ;
- déployer une modification métier sans recette du parcours complet concerné.

---

# 24. Production

Production :

```text
https://booking-extras.vercel.app
```

Le déploiement est hébergé sur Vercel.

Les variables sensibles de production doivent rester dans :

```text
Vercel → Settings → Environment Variables
```

Avant toute mise en production importante :

```bash
npm run lint
npm run build
```

et effectuer la recette correspondante en environnement maîtrisé.

---

# 25. Où commencer lorsqu'on reprend le projet ?

Ordre conseillé :

1. installer les dépendances ;
2. lancer Docker Desktop ;
3. lancer Supabase local ;
4. configurer `.env.local` ;
5. lancer `npx supabase db reset` ;
6. lancer `npm run dev` ;
7. se connecter avec la cheffe de test ;
8. parcourir :
   - Projets
   - Annonces
   - Candidatures
   - Figurants
   - Bookings
   - Essayages
   - Casting
   - Documents
9. tester ensuite le compte assistante ;
10. tester le compte candidate ;
11. seulement après, prendre la première carte Trello.

---

# 26. Fichiers à connaître absolument

```text
.env.example
package.json
src/middleware.ts

src/lib/auth/session.ts
src/lib/auth/sections.ts

src/lib/candidats/session.ts
src/lib/candidats/password.ts

src/lib/candidatures/actions.ts
src/lib/candidatures/jours.ts

src/lib/bookings/actions.ts

src/lib/figurants/actions.ts
src/lib/figurants/comedien-privacy.ts
src/lib/figurants/duplicates.ts

src/lib/media/compress-image.ts
src/lib/media/compress-video.ts
src/lib/media/compress-and-upload-video.ts

src/lib/email/send.ts

src/lib/rgpd/actions.ts

supabase/config.toml
supabase/seed.sql
supabase/migrations/
```

---

# 27. Documentation de reprise

Les cartes Trello du projet contiennent :

- le besoin métier ;
- le contexte ;
- la priorité ;
- les dépendances ;
- une partie technique destinée au développeur ;
- les fichiers concernés ;
- la procédure de travail ;
- les cas de test ;
- les critères permettant de considérer la carte comme terminée.

Le Trello doit rester la référence pour **ce qu'il faut faire**.

Le présent README doit rester la référence pour **comment installer, comprendre et travailler sur le projet**.

---

## Résumé express

Pour repartir de zéro :

```bash
git clone https://github.com/loicmaldonado-ship-it/Booking-Extras.git
cd Booking-Extras

npm install

npx supabase start

cp .env.example .env.local
npx supabase status -o env

# compléter .env.local

npx supabase db reset
npm run dev
```

Puis :

```text
http://localhost:3000/login
```

avec le compte de test défini dans `supabase/seed.sql`.

---

**Booking Extras — reprise et développement**
