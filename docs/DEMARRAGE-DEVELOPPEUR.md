# Démarrage développeur (vérifié le 30/10/2026)

Procédure suivie de bout en bout sur Linux (Docker, et Podman sans root) et dans un conteneur cloud, à partir de la
branche `tests/integration-main-elea-2026-10-22`. Aucun accès de production n'est nécessaire.

## 1. Prérequis
- Node.js 22 ou 24 (`node -v`).
- Docker Engine / Docker Desktop **ou** Podman. `docker ps` doit répondre sans `sudo`.
  - Podman : `systemctl --user enable --now podman.socket` puis
    `export DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock`.
- ~15 Go libres (images Supabase + `node_modules`). Sur un poste à petit quota (home réseau), travailler sur un disque local.

## 2. Installer
```bash
git clone <dépôt> booking-extras && cd booking-extras
git checkout tests/integration-main-elea-2026-10-22
npm ci
```

## 3. Base Supabase locale
```bash
npx supabase start -x vector,logflare,studio,imgproxy,edge-runtime,supavisor   # applique toutes les migrations + seed
npx supabase migration up --local     # sur une base déjà existante : applique seulement les nouvelles migrations
```
Ne jamais lancer `supabase db reset` sur une base qui contient des essais à conserver.

## 4. `.env.local`
```bash
cp .env.example .env.local
npx supabase status -o env            # API_URL, ANON_KEY, SERVICE_ROLE_KEY → NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
openssl rand -base64 32               # SECRETS_ENCRYPTION_KEY
npx web-push generate-vapid-keys      # NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
```
Garder `BOOKING_TEST_MODE=1` et les variables Gmail vides : aucun email, SMS, push ni relève réels.
Détail de chaque variable, génération et rotation : [docs/secrets.md](secrets.md).

## 5. Lancer
```bash
npm run dev          # développement, http://localhost:3000
# ou, comme en production :
npm run build && npm start
```
Comptes fictifs (mot de passe `booking-test`) : `cheffe.test@test-chat-charge.fr` (propriétaire), `assistante.test@test-chat-charge.fr`
sur `/login` ; `candidate.test@test-figurant.fr` sur `/compte/connexion`.

## 6. Vérifier
```bash
npm test && npm run lint && npm run typecheck     # tests unitaires (sans base)
bash scripts/integration-tests.sh                 # tests réels : base locale + appli lancée sur :3000 (npm start)
```
`scripts/integration-tests.sh` nécessite Playwright (`npm install --no-save playwright && npx playwright install chromium`).
Il couvre : suites SQL (RLS, droits, transactions), isolation entre équipes (base, stockage, 127 pages, 244 actions
serveur), authentification candidate et équipe, validation des fichiers, liens publics, barème par équipe, doublons.
La même batterie tourne dans la CI GitHub (`.github/workflows/ci.yml`, job `integration`).

## 7. Règles de travail
- Next.js 16 : lire `AGENTS.md` et `node_modules/next/dist/docs/` avant d'écrire du code (API différentes des versions antérieures).
- Base : toujours une **nouvelle** migration horodatée, jamais de modification d'une migration existante. Une nouvelle table
  publique doit déclarer RLS, policies et GRANT explicites (changement Supabase du 30/10/2026, `docs/supabase-30-octobre-2026.md`).
- Toute fonction exportée d'un fichier `"use server"` est appelable depuis le navigateur : contrôle d'accès au début, ou
  module `server-only` si elle n'est pas destinée au navigateur (cf. `src/lib/agents/upsert.ts`).
- Les listes de choix et pages qui lisent des figurants doivent passer par la RLS (client de session), pas par `createAdminClient()`.
- Suivi : `WORK_PROGRESS.md` ; état des cartes : Trello BOOKING-SITE.
