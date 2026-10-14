# Booking Extras — Guide d'installation et de développement local

Application de casting et de gestion de figurant·es : projets, annonces, candidatures, bookings, essayages, photos, vidéos, documents et exports.

**Stack actuelle de `elea` :** Next.js **16.4.0**, React 19, TypeScript, Node.js, npm, Supabase (PostgreSQL 17, Auth, Storage).

> **RÈGLE ABSOLUE : ne jamais modifier `main`.** Travailler exclusivement sur `elea` ou sur une branche de travail créée depuis `elea`. Aucun merge, aucun déploiement ni aucune opération sur la base de production ne fait partie de cette procédure.

Ce guide est destiné à une **nouvelle installation**, quel que soit l'ordinateur : macOS, Windows/WSL2, Ubuntu/Debian, Fedora et postes Linux sans droits `sudo`.

## 1. Prérequis

- **Git**, pour récupérer le dépôt.
- **Node.js 22 ou 24**, avec npm. Vérifier : `node -v` et `npm -v`.
- **Docker Engine + Docker Compose v2**, ou **Podman rootless** sur Linux lorsque Docker n'est pas accessible.
- **Supabase CLI** : utilisable via `npx`, sans installation globale. Les commandes de ce guide fixent la version **2.120.0**, déjà utilisée avec cette application.
- **Espace disque** : prévoir idéalement **10 à 15 Go libres** pour le projet, les dépendances, les images/volumes Supabase et les caches npm ; vérifier aussi les *inodes* sur Linux. Un quota de 4,7 Go est généralement trop limité.

| Système | Configuration recommandée |
| --- | --- |
| **macOS** (Intel ou Apple Silicon) | [Node.js](https://nodejs.org/), Git et [Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/). Démarrer Docker Desktop avant Supabase. |
| **Windows 10/11** | [WSL2](https://learn.microsoft.com/windows/wsl/install) (Ubuntu conseillé) + Docker Desktop avec intégration WSL. Exécuter les commandes dans le terminal WSL, pas PowerShell. |
| **Ubuntu / Debian / Linux personnel** | Node.js, Git et Docker Engine / Compose installés selon la [documentation officielle](https://docs.docker.com/engine/install/). |
| **Fedora / poste d'école sans `sudo`** | Node.js, Git, **Podman rootless**, service utilisateur Podman et `DOCKER_HOST` ; voir section 4. |

### Vérification initiale

```bash
node -v
npm -v
git --version
```

## 2. Cloner le dépôt sur la bonne branche

Sur **une nouvelle machine** :

```bash
git clone --branch elea https://github.com/loicmaldonado-ship-it/Booking-Extras.git
cd Booking-Extras
git branch --show-current
git status -sb
```

La branche doit être **`elea`**. En cas de dépôt déjà présent :

```bash
cd /chemin/vers/Booking-Extras
git status --short                 # regarder les modifications avant toute opération
git fetch origin
git switch elea
git pull --ff-only origin elea
git status -sb
```

Si `git switch` ou `git pull` refuse à cause de modifications locales, **ne pas écraser le travail** : le sauvegarder ou le committer sur une branche dédiée avant de continuer. Ne pas utiliser `git reset --hard` ni `git clean -fd` pour « réparer » une installation.

## 3. Installer les dépendances Node.js

À la racine de `Booking-Extras` :

```bash
npm ci
npx --no-install next --version
```

Résultat attendu : Next.js **16.4.0**. `npm ci` utilise les versions du `package-lock.json`. Des avertissements `deprecated` ne signifient pas nécessairement que l'installation a échoué.

**Si `next: command not found` apparaît**, cela signifie généralement que `npm ci` n'a pas abouti (souvent faute de place ou d'inodes). Voir le dépannage, section 10.

## 4. Démarrer Docker ou Podman

### macOS : Docker Desktop

1. Installer et ouvrir Docker Desktop.
2. Attendre que le moteur soit opérationnel.
3. Vérifier :

```bash
docker version
docker compose version
docker ps
```

### Windows : WSL2 + Docker Desktop

1. Installer WSL2 et une distribution Linux (Ubuntu conseillé).
2. Installer Docker Desktop et activer l'intégration avec **cette distribution WSL** dans les paramètres.
3. Dans le terminal **WSL/Ubuntu**, garder si possible le dépôt sous `~/projects` (plutôt que dans `/mnt/c`), puis exécuter :

```bash
docker version
docker compose version
docker ps
```

Les exemples `cp`, `export` et `mkdir -p` de ce README sont des commandes **bash** exécutées dans WSL sous Windows.

### Linux personnel : Docker Engine

Installer Docker Engine et le plugin Compose en suivant les consignes de sa distribution. Vérifier avec `docker version` et `docker compose version`. Les accès au socket Docker dépendent des droits système : ne pas modifier les permissions ni les groupes sans autorisation.

### Fedora ou Linux sans `sudo` : Podman rootless

Sur certains postes Fedora, `docker` est une **émulation Podman** (message `Emulate Docker CLI using podman`). On peut alors essayer le moteur rootless déjà installé :

```bash
podman info --format '{{.Host.Security.Rootless}}'  # attendu : true
systemctl --user enable --now podman.socket
export DOCKER_HOST="unix://$XDG_RUNTIME_DIR/podman/podman.sock"
systemctl --user is-active podman.socket          # attendu : active
podman ps
```

`DOCKER_HOST` est défini **uniquement pour le terminal courant**. Le redéfinir dans tout nouveau terminal utilisé pour Supabase, ou le placer dans sa configuration shell personnelle.

**Correctif Podman/Supabase rencontré sur Fedora :** créer ce dossier local avant `supabase start` :

```bash
mkdir -p supabase/snippets
```

Sinon Podman peut afficher `statfs .../supabase/snippets: no such file or directory`. La création du dossier n'efface aucune donnée.

**Attention sur un ordinateur partagé (école, entreprise) :** Supabase local peut exposer des ports sur `0.0.0.0`, y compris Studio sans authentification. Vérifier l'accès réseau avec l'administrateur et utiliser exclusivement des données fictives ; ne pas exposer cet environnement à Internet.

## 5. Démarrer Supabase en local

Depuis le répertoire racine du dépôt, après avoir lancé Docker ou préparé Podman :

```bash
npx --yes supabase@2.120.0 --version
npx --yes supabase@2.120.0 start
```

Au premier lancement, Supabase télécharge plusieurs Go d'images. Attendre `Started supabase local development setup.`

Si Supabase affiche **`Starting database from backup...`**, il reprend une base locale préexistante. **Ne pas la réinitialiser.**

| Service | Adresse locale |
| --- | --- |
| Supabase API | http://127.0.0.1:54321 |
| PostgreSQL | `127.0.0.1:54322` |
| Supabase Studio / SQL Editor | http://127.0.0.1:54323 |
| Mailpit | http://127.0.0.1:54324 |
| Application Next.js (après étape 8) | http://localhost:3000 |

Pour vérifier que les services tournent :

```bash
npx --yes supabase@2.120.0 status
```

**Important :** `status` peut afficher des informations sensibles ; ne pas diffuser sa sortie complète.

## 6. Configurer `.env.local`

Le fichier `.env.local` est **local à chaque ordinateur**, ignoré par Git. Il ne doit jamais être publié.

### Créer le fichier s'il n'existe pas

```bash
test -f .env.local || cp .env.example .env.local
nano .env.local                  # ou l'éditeur de votre choix
```

### Récupérer les identifiants de Supabase LOCAL

Après le démarrage réussi :

```bash
npx --yes supabase@2.120.0 status -o env
```

**Ne jamais partager cette sortie : elle peut contenir la clé Secret.** Reporter soi-même les valeurs dans `.env.local` :

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=REMPLACER_PAR_CLE_PUBLISHABLE_OU_ANON_LOCALE
SUPABASE_SERVICE_ROLE_KEY=REMPLACER_PAR_CLE_SECRET_OU_SERVICE_ROLE_LOCALE
NEXT_PUBLIC_SITE_URL=http://localhost:3000

SECRETS_ENCRYPTION_KEY=REMPLACER_PAR_CLE_LOCALE
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:test@example.com

GMAIL_SMTP_USER=
GMAIL_SMTP_APP_PASSWORD=
```

| Supabase CLI | Variable attendue dans le projet |
| --- | --- |
| `Project URL` / `API_URL` | `NEXT_PUBLIC_SUPABASE_URL` |
| `Publishable` (`sb_publishable_...`) ou ancienne `ANON_KEY` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `Secret` (`sb_secret_...`) ou ancienne `SERVICE_ROLE_KEY` | `SUPABASE_SERVICE_ROLE_KEY` |

Pour générer **une clé de chiffrement locale** :

```bash
openssl rand -base64 32
```

Reporter sa valeur dans `SECRETS_ENCRYPTION_KEY` sans la partager. Garder les variables Gmail **vides** pour éviter de vrais envois. Les variables VAPID peuvent rester vides si l'on ne teste pas les notifications push.

**Sécurité :** `SUPABASE_SERVICE_ROLE_KEY` est une clé privilégiée **réservée au serveur**, jamais au navigateur ou au dépôt Git. Ne jamais utiliser les clés Supabase/Vercel de production pour le développement local.

Après toute modification de `.env.local`, **redémarrer `npm run dev`**.

## 7. Base de données, migrations et comptes de démonstration

Les migrations sont dans `supabase/migrations/` et les données fictives dans `supabase/seed.sql`. **Chaque ordinateur a sa propre base locale :** les projets/comptes créés sur un autre ordinateur ne sont pas synchronisés par Git.

### Vérifier l'état de la base sans la modifier

Dans **Supabase Studio → SQL Editor** :

```sql
SELECT
  to_regclass('public.profiles') AS profiles,
  to_regclass('public.projets') AS projets,
  to_regclass('public.figurants') AS figurants,
  to_regclass('public.candidatures') AS candidatures;
```

Ces quatre colonnes doivent contenir un nom de table, et non `NULL`.

Si des migrations **manquent réellement**, les examiner, sauvegarder la base existante, puis appliquer **uniquement en local** :

```bash
npx --yes supabase@2.120.0 db push --local
```

Ne jamais lancer cette commande sans `--local` dans ce projet. Ne jamais lancer `db reset` pour corriger un problème de démarrage : **cela détruirait les données de la base locale**.

### Vérifier les comptes de test

Dans le SQL Editor :

```sql
SELECT email FROM auth.users
WHERE email IN (
  'cheffe.test@test-chat-charge.fr',
  'assistante.test@test-chat-charge.fr'
);
```

Les identifiants de démonstration, **uniquement si le seed a été importé**, sont :

| Rôle | Adresse de connexion | Email | Mot de passe |
| --- | --- | --- | --- |
| Camille (cheffe) | `/login` | `cheffe.test@test-chat-charge.fr` | `booking-test` |
| Alex (assistante) | `/login` | `assistante.test@test-chat-charge.fr` | `booking-test` |
| Sacha (candidate) | `/compte/connexion` | `candidate.test@test-figurant.fr` | `booking-test` |

Si les comptes **n'existent pas**, sur une **base de test vide**, migrée et sans autres données incompatibles, le seed peut être importé **une seule fois**. Il **n'est pas idempotent** ; ne pas le rejouer si les comptes existent.

**Docker :**

```bash
docker exec -i supabase_db_BOOKING_EXTRAS \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction \
  < supabase/seed.sql
```

**Podman rootless :**

```bash
podman exec -i supabase_db_BOOKING_EXTRAS \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction \
  < supabase/seed.sql
```

La transaction évite un import partiel en cas d'erreur SQL. N'utiliser ces commandes que sur les conteneurs **locaux**. La présence d'une base locale reprise depuis une sauvegarde exige une vérification avant d'importer quoi que ce soit.

## 8. Lancer l'application

Depuis le dépôt, avec Supabase déjà actif et `.env.local` rempli :

```bash
npm run dev
```

Ouvrir **http://localhost:3000**.

- Connexion équipe : http://localhost:3000/login
- Connexion candidat : http://localhost:3000/compte/connexion
- Casting interne : http://localhost:3000/casting

`Ctrl+C` arrête Next.js, mais n'arrête **pas** automatiquement les conteneurs Supabase.

## 9. Tests qualité et vérification avant commit

```bash
npm test
npm run lint
npm run typecheck
npm run build
git status -sb
```

Sur macOS, en octobre 2026, une version de travail de `elea` a passé **38 tests automatisés**, ESLint, TypeScript et le build Next.js. Cela ne valide **pas automatiquement** une nouvelle installation ni tous les parcours réels : refaire les tests sur chaque environnement et poursuivre l'audit manuel des autorisations, PDF, vidéos et candidatures.

Avant toute modification du code Next.js 16, lire `AGENTS.md` puis, après installation, la documentation de la version courante dans `node_modules/next/dist/docs/`.

## 10. Dépannage

### `next: command not found`

Les dépendances sont absentes ou `npm ci` s'est interrompu. Vérifier :

```bash
df -h .
df -i .
ls -l node_modules/.bin/next
```

Si l'espace disque et les inodes sont suffisants, relancer `npm ci` puis `npx --no-install next --version`. Si un `node_modules` **incomplet** occupe beaucoup de place après un échec, il peut être supprimé puis recréé avec `npm ci` ; **ne jamais supprimer le code source ou les volumes Supabase**.

### `ENOSPC: no space left on device`

L'espace disque personnel est plein **ou il n'y a plus d'inodes** (très fréquent sur un poste Linux à quota) :

```bash
df -h "$HOME" /tmp
df -i "$HOME"
du -sh node_modules ~/.npm ~/.local/share/containers/storage 2>/dev/null
podman system df
```

Ne pas relancer les installations en boucle. Prévoir un emplacement/volume plus grand, ou demander une augmentation du quota. **Ne pas faire `podman system prune --volumes`** : risque de suppression de données locales.

### `Your project's URL and Key are required`

Au moins l'une des variables `NEXT_PUBLIC_SUPABASE_URL` ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` est vide/absente. Vérifier `.env.local`, recopier les clés **locales**, puis redémarrer `npm run dev`. **Ne pas afficher les clés dans les échanges d'assistance.**

### `no such container supabase_db_BOOKING_EXTRAS`

La base Supabase locale n'est pas démarrée ou le moteur des conteneurs est inaccessible. Vérifier `docker ps -a` ou `podman ps -a`, puis `npx --yes supabase@2.120.0 start`. **Pas de `db reset`.**

### `Emulate Docker CLI using podman`

C'est un message normal de la commande `docker` fournie par Podman. Vérifier `podman.socket`, puis redéfinir dans le terminal :

```bash
export DOCKER_HOST="unix://$XDG_RUNTIME_DIR/podman/podman.sock"
```

### `statfs .../supabase/snippets: no such file or directory`

Sur Fedora + Podman :

```bash
mkdir -p supabase/snippets
npx --yes supabase@2.120.0 start
```

### `Email ou mot de passe incorrect` avec un compte de démonstration

La base de cet ordinateur ne possède peut-être pas encore les comptes du seed. Vérifier `auth.users` dans Supabase Studio **avant** de retenter les connexions. Les comptes créés sur macOS n'existent pas automatiquement sur Fedora. Ne jamais utiliser des comptes de production.

### Port 3000 ou 54321–54324 occupé

Identifier l'autre processus et corriger le conflit. Éviter de changer les ports sans adapter les URL locales et les redirections Supabase/Auth.

### Erreur de santé ou de stockage Podman

Regarder `podman ps -a`, `podman system df` et la sortie de `supabase start`. **Ne pas supprimer les volumes, les sauvegardes ou les images sans diagnostic préalable.**

## 11. Commandes utiles et sécurité

```bash
# Vérifier la bonne branche

git branch --show-current
git status -sb

# Démarrer Supabase (Docker/Podman déjà opérationnel)
npx --yes supabase@2.120.0 start

# Démarrer Next.js dans un autre terminal
npm run dev

# Vérifications qualité
npm test && npm run lint && npm run typecheck && npm run build

# Se mettre à jour uniquement depuis elea, après vérification du travail local
git fetch origin
git pull --ff-only origin elea
```

**Interdictions/précautions :** ne jamais committer `.env.local`, un dump, une clé API privée, un secret SMTP ou un token GitHub ; ne pas lancer de reset destructeur ; ne pas travailler sur `main` ; ne pas appliquer de migrations à une base distante ; ne pas publier cet environnement local sur un réseau partagé.

## 12. Documentation complémentaire

- `README_Booking_Extras.md` : passation historique.
- `docs/architecture.md`, `docs/database.md` : architecture et schéma de données.
- `docs/security.md`, `docs/security-audit-snapshot.md` : sécurité, protections et limites.
- `docs/testing.md`, `docs/recette.md` : contrôles techniques et recette métier.
- `docs/trello-report.md`, `docs/technical-debt.md` : suivi des fonctionnalités et dette technique.
- `docs/deployment.md` : préparation au déploiement, **pas** une autorisation de déployer.

**La branche `main` est strictement hors périmètre de ce guide.**