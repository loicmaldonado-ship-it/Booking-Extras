#!/bin/bash
cd "$(dirname "$0")" || exit 1
node scripts/recette-local.mjs --stop
result=$?
if [ "$result" -ne 0 ]; then
  read -r -p "Appuyez sur Entrée pour fermer."
fi
exit "$result"
