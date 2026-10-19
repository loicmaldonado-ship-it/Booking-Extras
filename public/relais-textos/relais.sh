#!/bin/bash
# Booking Extras — relais textos du Mac.
# Récupère les textos mis en file sur le site (clé personnelle) et les
# envoie un par un avec l'app Messages, depuis ton numéro, en espaçant les
# envois pour ne pas être pris pour du spam. Remonte aussi au site les
# réponses reçues dans Messages, uniquement de la part des numéros à qui le
# site a écrit (il faut autoriser l'« Accès complet au disque »). Avec cet
# accès, chaque texto part d'abord en iMessage, puis en SMS par l'iPhone si
# la personne n'a pas iMessage, et il est vérifié et renvoyé s'il finit
# « Non distribué ».
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
# sa base le dernier message parti vers ce numéro après « avant », toutes
# les 5 s pendant « tours » × 5 s. Affiche « ok <service> », « echec <code>
# <service> », « attente <service> » (toujours en cours), « absent » (pas
# trouvé) ou « acces » (pas d'Accès complet au disque).
etat_distribution() {
  local tel="$1" avant="$2" tours="$3" t ligne code envoye service dernier=absent
  sqlite3 "file:$CHATDB?mode=ro" "select 1" > /dev/null 2>&1 || { echo acces; return; }
  for ((t = 0; t < tours; t++)); do
    sleep 5
    ligne=$(sqlite3 "file:$CHATDB?mode=ro" "SELECT m.error || '|' || m.is_sent || '|' || m.service FROM message m JOIN handle h ON h.ROWID = m.handle_id WHERE m.is_from_me = 1 AND m.ROWID > ${avant:-0} AND h.id = '$tel' ORDER BY m.ROWID DESC LIMIT 1" 2> /dev/null)
    [ -z "$ligne" ] && continue
    IFS='|' read -r code envoye service <<< "$ligne"
    if [ "${code:-0}" != "0" ]; then echo "echec $code $service"; return; fi
    if [ "$envoye" = "1" ]; then echo "ok $service"; return; fi
    dernier="attente $service"
  done
  echo "$dernier"
}

dernier_message() {
  sqlite3 "file:$CHATDB?mode=ro" "SELECT COALESCE(MAX(ROWID),0) FROM message" 2> /dev/null || echo 0
}

# Un essai : confie le texto à Messages avec ce mode, puis attend son état.
essai_envoi() {
  local tel="$1" texte="$2" mode="$3" tours="$4" avant sortie
  avant=$(dernier_message)
  if ! sortie=$(osascript "$DOSSIER/envoyer.applescript" "$tel" "$texte" "$mode" 2>&1); then
    echo "refus $sortie"
    return
  fi
  etat_distribution "$tel" "$avant" "$tours"
}

# iMessage ou SMS pour ce numéro, d'après l'historique de Messages (90 jours) :
# dernier iMessage refusé → « sms » ; iMessage passé ou reçu → « imessage » ;
# message reçu en SMS / RCS → « sms » ; inconnu → « imessage » (essayé
# d'abord). Les SMS qu'on a envoyés ne comptent pas (l'ancien relais forçait
# le SMS, même pour les iPhone).
service_prefere() {
  local tel="$1" ligne service moi code envoye
  ligne=$(sqlite3 "file:$CHATDB?mode=ro" "SELECT m.service || '|' || m.is_from_me || '|' || m.error || '|' || m.is_sent FROM message m JOIN handle h ON h.ROWID = m.handle_id WHERE h.id = '$tel' AND m.date > (strftime('%s','now') - 978307200 - 90*86400) * 1000000000 AND (m.service = 'iMessage' OR m.is_from_me = 0) ORDER BY m.ROWID DESC LIMIT 1" 2> /dev/null)
  [ -z "$ligne" ] && { echo imessage; return; }
  IFS='|' read -r service moi code envoye <<< "$ligne"
  if [ "$service" = "iMessage" ]; then
    if [ "$moi" = "1" ] && [ "${code:-0}" != "0" ]; then echo sms; else echo imessage; fi
  else
    echo sms
  fi
}

# iMessage d'abord (part directement du Mac, instantané pour les iPhone),
# sauf numéro connu sans iMessage ; s'il échoue, SMS par l'iPhone, avec un nouvel
# essai si « Non distribué ». Sans Accès complet au disque : un seul envoi
# dans le mode réglé, sans vérification (ancien fonctionnement).
envoyer_avec_verification() {
  local tel="$1" texte="$2" etat essai
  if ! sqlite3 "file:$CHATDB?mode=ro" "select 1" > /dev/null 2>&1 || [ "$MODE" = "sms-seul" ]; then
    if sortie=$(osascript "$DOSSIER/envoyer.applescript" "$tel" "$texte" "${MODE/-seul/}" 2>&1); then
      journal "Envoyé à $tel (distribution non vérifiée : pas d'accès à Messages)"
      return 0
    fi
    erreur="$sortie"
    return 1
  fi
  if [ "$(service_prefere "$tel")" = "imessage" ]; then
    etat=$(essai_envoi "$tel" "$texte" imessage-seul 6)
    case "$etat" in
      ok*) journal "Envoyé à $tel ($etat)"; return 0 ;;
    esac
    journal "iMessage impossible pour $tel ($etat), passage en SMS"
  fi
  for essai in 1 2; do
    etat=$(essai_envoi "$tel" "$texte" sms-seul 36)
    case "$etat" in
      ok*) journal "Envoyé à $tel ($etat, essai SMS $essai)"; return 0 ;;
      attente*)
        # Toujours en cours au bout de 3 min : pas de nouvel essai (risque
        # de doublon), mais signalé sur le site.
        erreur="SMS bloqué en cours d'envoi au bout de 3 min ($etat) : vérifie le Transfert de SMS de l'iPhone"
        return 1 ;;
    esac
    erreur="Non distribué en SMS ($etat)"
    journal "Essai SMS $essai pour $tel : $erreur"
    [ "$essai" -lt 2 ] && sleep 20
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
        journal "Échec pour $tel : $erreur"
        ok=0
      fi
    fi
    curl -fsS -m 30 -X POST -H "Authorization: Bearer $CLE" -H "Content-Type: application/json" \
      --data "$(json_resultat "$id" "$ok" "$erreur")" "$SITE/api/relais-textos/resultat" > /dev/null
    sleep $(( RANDOM % (DELAI_MAX - DELAI_MIN + 1) + DELAI_MIN ))
  done
done
