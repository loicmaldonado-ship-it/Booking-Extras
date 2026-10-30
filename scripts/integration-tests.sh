#!/usr/bin/env bash
# Tests d'intégration réels (30/10/2026) : base Supabase LOCALE + application lancée sur http://localhost:3000
# (npm run build && npm start) avec un .env.local local et BOOKING_TEST_MODE=1. Aucune donnée réelle ; chaque test
# crée ses données fictives et les supprime. Usage : bash scripts/integration-tests.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${SUPABASE_DB_CONTAINER:-supabase_db_BOOKING_EXTRAS}"
grep -q '^BOOKING_TEST_MODE=1' .env.local || { echo "BOOKING_TEST_MODE=1 requis dans .env.local"; exit 1; }
grep -Eq '^NEXT_PUBLIC_SUPABASE_URL=http://(127\.0\.0\.1|localhost)' .env.local || { echo "Base locale uniquement"; exit 1; }
fail=0
echo "== Suites SQL (transaction annulée) =="
for f in tests/*-local.sql; do
  # rgpd-snapshot dépend d'identifiants de la base de recette d'Éléa, absents du seed.
  [[ "$f" == *rgpd-snapshot-local.sql ]] && continue
  if out=$(docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$f" 2>&1) && ! grep -q ERROR <<<"$out"; then echo "OK  $f"; else echo "KO  $f"; grep -m1 ERROR <<<"$out" || true; fail=1; fi
done
echo "== Tests navigateur / API sur l'application =="
docker exec -i "$DB" psql -U postgres -d postgres -qc "delete from candidate_auth_attempts" >/dev/null
for t in qa06-mobile-a11y storage-isolation-local auth-e2e-local bug11-upload-validation can03-doublons-local bug08-share-token-access sec05-share-links sec04-read-leak-pages bug02-all-actions-cross-team; do
  if node "tests/$t.mjs" > "/tmp/integration-$t.log" 2>&1; then echo "OK  $t"; else echo "KO  $t"; tail -5 "/tmp/integration-$t.log"; fail=1; fi
  docker exec -i "$DB" psql -U postgres -d postgres -qc "delete from candidate_auth_attempts" >/dev/null
done
for t in med01-compression-images med02-envoi-video bug13-erreurs-mutations; do
  if node "tests/$t.mjs" > "/tmp/integration-$t.log" 2>&1; then echo "OK  $t"; else echo "KO  $t"; tail -5 "/tmp/integration-$t.log"; fail=1; fi
done
# QA-08 : lit le journal de `npm start` (NEXT_LOG, défaut /tmp/next.log comme dans la CI).
if [ -f "${NEXT_LOG:-/tmp/next.log}" ]; then
  if node tests/qa08-journal-erreurs.mjs > /tmp/integration-qa08.log 2>&1; then echo "OK  qa08-journal-erreurs"; else echo "KO  qa08-journal-erreurs"; tail -5 /tmp/integration-qa08.log; fail=1; fi
else echo "KO  qa08-journal-erreurs : journal de l'appli introuvable (NEXT_LOG)"; fail=1; fi
# Recette technique (MET/COM/CAN) : nécessite la capture des emails par Mailpit (BOOKING_TEST_SMTP_URL dans .env.local).
if grep -q '^BOOKING_TEST_SMTP_URL=smtp' .env.local 2>/dev/null; then
  if node tests/recette-technique-e2e.mjs > /tmp/integration-recette.log 2>&1; then echo "OK  recette-technique-e2e"; else echo "KO  recette-technique-e2e"; tail -5 /tmp/integration-recette.log; fail=1; fi
  docker exec -i "$DB" psql -U postgres -d postgres -qc "delete from candidate_auth_attempts" >/dev/null
else echo "KO  recette-technique-e2e : BOOKING_TEST_SMTP_URL absent de .env.local (voir .env.example)"; fail=1; fi
for t in sec04-read-leak-pages bug02-all-actions-cross-team; do
  if ACTOR=assistante-hors-projet node "tests/$t.mjs" > "/tmp/integration-$t-assistante.log" 2>&1; then echo "OK  $t (assistante hors projet)"; else echo "KO  $t (assistante hors projet)"; tail -5 "/tmp/integration-$t-assistante.log"; fail=1; fi
done
exit $fail
