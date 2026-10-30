# Secrets et variables d'environnement (SEC-06, 30/10/2026)

## Classement
| Variable | Exposée au navigateur | Rôle |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | oui (publiques par conception) | client Supabase ; la clé anon ne donne que les droits RLS |
| `NEXT_PUBLIC_SITE_URL` | oui | liens dans les emails et partages |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | oui | abonnement aux notifications push |
| `SUPABASE_SERVICE_ROLE_KEY` | **non** | client admin (`src/lib/supabase/admin.ts`, `server-only`) |
| `SECRETS_ENCRYPTION_KEY` | **non** | chiffrement AES-GCM des mots de passe Gmail stockés (`src/lib/crypto/secrets.ts`, `server-only`) |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | **non** | envoi push (`src/lib/push/send.ts`, `server-only`) |
| `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD` | **non** | boîte d'envoi support ; VIDES en local |
| `CRON_SECRET` | **non** | authentifie les appels de tâches planifiées |
| `AUTH_RATE_LIMIT_SECRET` | **non** | hachage des clés du limiteur candidat |
| `BOOKING_TEST_MODE` | non | `1` = aucun email, SMS, push ni relève Gmail réels |

Contrôles du 30/10 : aucun composant `"use client"` n'importe de module serveur ni ne lit de variable non `NEXT_PUBLIC_` ;
les modules sensibles importent `server-only` (le build échoue en cas d'import côté navigateur) ; l'historique Git complet
(667 commits, toutes branches) ne contient ni clé JWT réelle, ni clé privée, ni jeton GitHub/AWS, ni mot de passe Gmail
(seules les clés de DÉMO publiques de Supabase local apparaissent) ; `.env*` est ignoré sauf `.env.example`.

## Trois jeux séparés
- **Local** : clés générées par `npx supabase start`, `BOOKING_TEST_MODE=1`, Gmail vide, secrets générés localement.
- **Préproduction** : projet Supabase distinct, secrets distincts de la production, boîte Gmail de test.
- **Production** : variables uniquement dans Vercel (Settings → Environment Variables), jamais dans Git, Trello ou README.

## Génération
```bash
openssl rand -base64 32          # SECRETS_ENCRYPTION_KEY
openssl rand -hex 32             # CRON_SECRET, AUTH_RATE_LIMIT_SECRET
npx web-push generate-vapid-keys # NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY
```

## Rotation
- `SUPABASE_SERVICE_ROLE_KEY` / anon : régénérer dans Supabase (Settings → API, JWT secret), mettre à jour Vercel, redéployer.
- `CRON_SECRET`, `AUTH_RATE_LIMIT_SECRET` : remplacer dans Vercel puis redéployer (le limiteur repart à zéro : sans conséquence).
- `VAPID_*` : une nouvelle paire invalide les abonnements push existants ; les candidates devront réactiver les notifications.
- `SECRETS_ENCRYPTION_KEY` : **une simple substitution rend illisibles les mots de passe Gmail déjà chiffrés.** Procédure :
  1. lire et déchiffrer chaque `gmail_smtp_app_password` (profiles et projets) avec l'ancienne clé, côté serveur ;
  2. les rechiffrer avec la nouvelle clé dans une même transaction ;
  3. basculer la variable dans Vercel et redéployer.
  À défaut de script de migration, demander aux cheffes de ressaisir leur mot de passe d'application Gmail après rotation.

## À faire par une personne ayant accès à Vercel et Supabase (non vérifiable depuis cette reprise)
Vérifier que la production définit bien `CRON_SECRET`, `SECRETS_ENCRYPTION_KEY`, les clés VAPID et que `BOOKING_TEST_MODE` n'y est PAS à 1 ;
vérifier que les valeurs de production diffèrent de toute valeur ayant circulé hors de Vercel.
