#!/bin/bash
# Booking Extras — installation du relais textos sur ce Mac.
# Usage : curl -fsSL <site>/relais-textos/installer.sh | bash -s -- <site> <clé> [sms|imessage]
set -e
SITE="${1%/}"
CLE="$2"
MODE="${3:-sms}"
if [ -z "$SITE" ] || [ -z "$CLE" ]; then
  echo "Usage : installer.sh <adresse du site> <clé du relais> [sms|imessage]"
  exit 1
fi
DOSSIER="$HOME/Library/Application Support/BookingExtrasRelais"
AGENT="$HOME/Library/LaunchAgents/fr.bookingextras.relais-textos.plist"
JOURNAL="$HOME/Library/Logs/booking-extras-relais.log"
mkdir -p "$DOSSIER" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

echo "→ Téléchargement du relais…"
curl -fsSL "$SITE/relais-textos/relais.sh" -o "$DOSSIER/relais.sh"
curl -fsSL "$SITE/relais-textos/envoyer.applescript" -o "$DOSSIER/envoyer.applescript"
curl -fsSL "$SITE/relais-textos/reponses.js" -o "$DOSSIER/reponses.js"
chmod 700 "$DOSSIER/relais.sh"

umask 077
cat > "$DOSSIER/config" <<CONF
SITE="$SITE"
CLE="$CLE"
MODE="$MODE"
DELAI_MIN=8
DELAI_MAX=15
TEST=""
CONF

echo "→ Autorisation de l'app Messages (clique « OK » / « Autoriser » si macOS le demande)…"
osascript "$DOSSIER/envoyer.applescript" "" "" "verifier" > /dev/null || true

cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>fr.bookingextras.relais-textos</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$DOSSIER/relais.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$JOURNAL</string>
  <key>StandardErrorPath</key><string>$JOURNAL</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/fr.bookingextras.relais-textos" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$AGENT"
echo "✅ Relais installé : il tourne en arrière-plan et redémarre avec le Mac."
echo ""
echo "📥 Pour que les réponses texto remontent sur le site :"
echo "   Réglages Système → Confidentialité et sécurité → Accès complet au disque"
echo "   → bouton + → Cmd+Maj+G → tape /bin/bash → Ouvrir, et active-le."
echo "   (Seules les réponses des numéros à qui le site a écrit sont lues.)"
echo "   Journal : $JOURNAL"
echo "   Pour le désinstaller : launchctl bootout gui/\$(id -u)/fr.bookingextras.relais-textos && rm \"$AGENT\""
