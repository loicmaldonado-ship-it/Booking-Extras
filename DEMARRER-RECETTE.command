#!/bin/bash
cd "$(dirname "$0")" || exit 1
node scripts/recette-local.mjs
result=$?
if [ "$result" -ne 0 ]; then
  echo "Le lancement a échoué. Transmettez le message ci-dessus à Éléa."
  read -r -p "Appuyez sur Entrée pour fermer."
fi
exit "$result"
