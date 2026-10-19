#!/bin/bash
# Booking Extras — relais textos du Mac.
# Récupère les textos mis en file sur le site (clé personnelle) et les
# envoie un par un avec l'app Messages, depuis ton numéro, en espaçant les
# envois pour ne pas être pris pour du spam. Remonte aussi au site les
# réponses reçues dans Messages, uniquement de la part des numéros à qui le
# site a écrit (il faut autoriser l'« Accès complet au disque »). Avec cet
# accès, chaque texto est aussi vérifié après l'envoi et renvoyé tout seul
# s'il finit « Non distribué ».
DOSSIER="${BOOKING_RELAIS_DOSSIER:-$HOME/Library/Application Support/BookingExtrasRelais}"
source "$DOSSIER/config"   # SITE, CLE, MODE, DELAI_MIN, DELAI_MAX, TEST
TMP="$DOSSIER/reponse.json"
journal() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }
CHATDB="${BOOKING_CHAT_DB:-$HOME/Library/Messages/chat.db}"
ETAT_SMS="$DOSSIER/dernier_sms"
derniere_releve=0
acces_signale=""

envoyer_reponses() {
  curl -fsS -m 30 -X POST -H "Authorization: Bearer $CLE" -H "Content-Type: application/json" \
    --data @"$1" "$SITE/api/relais-textos/reponses" > /dev/null
}

# Réponses reçues dans Messages → site (au plus une fois par minute).
relever_reponses() {
  [ -n "$TEST" ] && [ -z "$BOOKING_CHAT_DB" ] && return 0
  local maintenant; maintenant=$(date +%s)
  (( maintenant - derniere_releve < 60 )) && return 0
  derniere_releve=$maintenant
  [ -f "$DOSSIER/reponses.js" ] || return 0
  if ! sqlite3 "file:$CHATDB?mode=ro" "select 1" > /dev/null 2>&1; then
    if [ -z "$acces_signale" ]; then
      journal "Réponses texto : accès à Messages refusé (Réglages → Confidentialité → Accès complet au disque)"
      acces_signale=1
    fi
    echo '{"erreur":"acces"}' > "$DOSSIER/reponses.json"
    envoyer_reponses "$DOSSIER/reponses.json"
    return 0
  fi
  acces_signale=""
  curl -fsS -m 30 -X POST -H "Authorization: Bearer $CLE" "$SITE/api/relais-textos/numeros" -o "$DOSSIER/numeros.json" || return 0
  if [ ! -s "$ETAT_SMS" ]; then
    # Premier passage : on reprend les 3 derniers jours.
    sqlite3 "file:$CHATDB?mode=ro" "SELECT COALESCE(MAX(ROWID),0) FROM message WHERE date < (strftime('%s','now')-978307200-259200)*1000000000" > "$ETAT_SMS"
  fi
  local nb liste="" i tel dernier
  nb=$(plutil -extract numeros raw -o - "$DOSSIER/numeros.json" 2>/dev/null || echo 0)
  for ((i = 0; i < nb; i++)); do
    tel=$(plutil -extract "numeros.$i" raw -o - "$DOSSIER/numeros.json")
    tel="${tel//[^+0-9]/}"
    [ -n "$tel" ] && liste+="${liste:+,}'$tel'"
  done
  dernier=$(cat "$ETAT_SMS")
  if [ -z "$liste" ]; then
    echo '{"reponses":[]}' > "$DOSSIER/reponses.json"
    envoyer_reponses "$DOSSIER/reponses.json"
    return 0
  fi
  sqlite3 -json "file:$CHATDB?mode=ro" "SELECT m.ROWID AS rowid, m.guid AS guid, h.id AS tel, m.date AS date, m.text AS texte, hex(m.attributedBody) AS corps_hex FROM message m JOIN handle h ON h.ROWID = m.handle_id WHERE m.is_from_me = 0 AND m.ROWID > ${dernier:-0} AND h.id IN ($liste) ORDER BY m.ROWID LIMIT 200" > "$DOSSIER/messages.json" 2> /dev/null || return 0
  local nouveau
  nouveau=$(osascript -l JavaScript "$DOSSIER/reponses.js" "$DOSSIER/messages.json" "$DOSSIER/reponses.json" "${dernier:-0}") || return 0
  if envoyer_reponses "$DOSSIER/reponses.json"; then
    [ "$nouveau" != "${dernier:-0}" ] && journal "Réponses texto remontées au site (jusqu'au message $nouveau)"
    echo "$nouveau" > "$ETAT_SMS"
  fi
}

# Distribution d'un texto qu'on vient de confier à Messages : regarde dans
# sa base le message parti vers ce numéro après « avant ». Affiche « ok »,
# « echec <code> » ou « inconnu » (pas d'accès à la base, ou toujours en
# cours au bout de 90 s). Sert à renvoyer tout seul les « Non distribué ».
etat_distribution() {
  local tel="$1" avant="$2" t ligne
  sqlite3 "file:$CHATDB?mode=ro" "select 1" > /dev/null 2>&1 || { echo inconnu; return; }
  for ((t = 0; t < ${VERIF_TOURS:-18}; t++)); do
    sleep 5
    ligne=$(sqlite3 "file:$CHATDB?mode=ro" "SELECT m.error || '|' || m.is_sent || '|' || m.service FROM message m JOIN handle h ON h.ROWID = m.handle_id WHERE m.is_from_me = 1 AND m.ROWID > ${avant:-0} AND h.id = '$tel' ORDER BY m.ROWID DESC LIMIT 1" 2> /dev/null)
    [ -z "$ligne" ] && continue
    IFS='|' read -r code envoye service <<< "$ligne"
    if [ "${code:-0}" != "0" ]; then echo "echec $code ($service)"; return; fi
    if [ "$envoye" = "1" ]; then echo "ok ($service)"; return; fi
  done
  echo inconnu
}

dernier_message() {
  sqlite3 "file:$CHATDB?mode=ro" "SELECT COALESCE(MAX(ROWID),0) FROM message" 2> /dev/null || echo 0
}

# Confie le texto à Messages puis vérifie qu'il est parti ; « Non
# distribué » → nouvel essai (comme « Réessayer » dans Messages), jusqu'à 3.
envoyer_avec_verification() {
  local tel="$1" texte="$2" essai avant sortie etat
  for essai in 1 2 3; do
    avant=$(dernier_message)
    if ! sortie=$(osascript "$DOSSIER/envoyer.applescript" "$tel" "$texte" "$MODE" 2>&1); then
      erreur="$sortie"
    else
      etat=$(etat_distribution "$tel" "$avant")
      case "$etat" in
        ok*) journal "Envoyé à $tel ($etat, essai $essai)"; return 0 ;;
        inconnu) journal "Envoyé à $tel (distribution non vérifiée)"; return 0 ;;
        *) erreur="Non distribué : $etat" ;;
      esac
    fi
    journal "Essai $essai pour $tel : $erreur"
    [ "$essai" -lt 3 ] && sleep $(( essai * 20 ))
  done
  return 1
}

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
  relever_reponses
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
    else
      tel="${tel//[^+0-9]/}"
      erreur=""
      if envoyer_avec_verification "$tel" "$texte"; then
        ok=1; erreur=""
      else
        journal "Échec pour $tel après 3 essais : $erreur"
        ok=0
      fi
    fi
    curl -fsS -m 30 -X POST -H "Authorization: Bearer $CLE" -H "Content-Type: application/json" \
      --data "$(json_resultat "$id" "$ok" "$erreur")" "$SITE/api/relais-textos/resultat" > /dev/null
    sleep $(( RANDOM % (DELAI_MAX - DELAI_MIN + 1) + DELAI_MIN ))
  done
done
