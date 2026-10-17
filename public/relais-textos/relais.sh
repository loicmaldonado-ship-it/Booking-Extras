#!/bin/bash
# Booking Extras — relais textos du Mac.
# Récupère les textos mis en file sur le site (clé personnelle) et les
# envoie un par un avec l'app Messages, depuis ton numéro, en espaçant les
# envois pour ne pas être pris pour du spam.
DOSSIER="${BOOKING_RELAIS_DOSSIER:-$HOME/Library/Application Support/BookingExtrasRelais}"
source "$DOSSIER/config"   # SITE, CLE, MODE, DELAI_MIN, DELAI_MAX, TEST
TMP="$DOSSIER/reponse.json"
journal() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

json_resultat() {
  osascript -l JavaScript -e 'function run(a){return JSON.stringify({id:a[0],ok:a[1]==="1",erreur:a[2]})}' "$1" "$2" "$3"
}

journal "Relais démarré (site : $SITE, mode : $MODE${TEST:+, TEST sans envoi})"
while true; do
  if ! curl -fsS -m 30 -X POST -H "Authorization: Bearer $CLE" "$SITE/api/relais-textos/suivants" -o "$TMP"; then
    journal "Site injoignable ou clé refusée, nouvel essai dans 60 s"
    sleep 60
    continue
  fi
  n=$(plutil -extract textos raw -o - "$TMP" 2>/dev/null || echo 0)
  if [ "$n" = "0" ]; then
    sleep 20
    continue
  fi
  for ((i = 0; i < n; i++)); do
    id=$(plutil -extract "textos.$i.id" raw -o - "$TMP")
    tel=$(plutil -extract "textos.$i.telephone" raw -o - "$TMP")
    texte=$(plutil -extract "textos.$i.message" raw -o - "$TMP")
    if [ -n "$TEST" ]; then
      journal "TEST — pas envoyé à $tel : ${texte:0:60}…"
      ok=1; erreur=""
    elif sortie=$(osascript "$DOSSIER/envoyer.applescript" "$tel" "$texte" "$MODE" 2>&1); then
      journal "Envoyé à $tel"
      ok=1; erreur=""
    else
      journal "Échec pour $tel : $sortie"
      ok=0; erreur="$sortie"
    fi
    curl -fsS -m 30 -X POST -H "Authorization: Bearer $CLE" -H "Content-Type: application/json" \
      --data "$(json_resultat "$id" "$ok" "$erreur")" "$SITE/api/relais-textos/resultat" > /dev/null
    sleep $(( RANDOM % (DELAI_MAX - DELAI_MIN + 1) + DELAI_MIN ))
  done
done
