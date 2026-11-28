// Booking Extras — relais textos du Mac : mise en forme des réponses reçues.
// Lit l'export des messages (sqlite3 -json), retrouve le texte de chacun
// (colonne text, ou corps « attributedBody » des macOS récents) et écrit le
// paquet à envoyer au site. Affiche le nouveau dernier identifiant lu.
// Usage : osascript -l JavaScript reponses.js <entrée.json> <sortie.json> <dernier>
ObjC.import("Foundation");

function lire(chemin) {
  const s = $.NSString.stringWithContentsOfFileEncodingError(chemin, $.NSUTF8StringEncoding, null);
  return s.isNil() ? "" : s.js;
}

function ecrire(chemin, texte) {
  $(texte).writeToFileAtomicallyEncodingError(chemin, true, $.NSUTF8StringEncoding, null);
}

function octetsDepuisHex(hex) {
  const octets = [];
  for (let i = 0; i + 1 < hex.length; i += 2) octets.push(parseInt(hex.substr(i, 2), 16));
  return octets;
}

function texteUtf8(octets) {
  const b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let b64 = "";
  for (let i = 0; i < octets.length; i += 3) {
    const a = octets[i], b = octets[i + 1], c = octets[i + 2];
    const n = (a << 16) | ((b || 0) << 8) | (c || 0);
    b64 += b64chars[(n >> 18) & 63] + b64chars[(n >> 12) & 63] + (b === undefined ? "=" : b64chars[(n >> 6) & 63]) + (c === undefined ? "=" : b64chars[n & 63]);
  }
  const data = $.NSData.alloc.initWithBase64EncodedStringOptions(b64, 0);
  const s = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding);
  return s.isNil() ? "" : s.js;
}

// Corps « attributedBody » (typedstream) : le texte suit le marqueur
// NSString, après l'octet « + » et sa longueur.
function texteDepuisCorps(hex) {
  if (!hex) return "";
  const o = octetsDepuisHex(hex);
  const marqueur = [0x4e, 0x53, 0x53, 0x74, 0x72, 0x69, 0x6e, 0x67]; // NSString
  for (let i = 0; i + marqueur.length < o.length; i++) {
    if (!marqueur.every((m, k) => o[i + k] === m)) continue;
    let j = i + marqueur.length;
    while (j < o.length && o[j] !== 0x2b) j++;
    j++;
    if (j >= o.length) return "";
    let longueur = o[j];
    j++;
    if (longueur === 0x81) {
      longueur = o[j] | (o[j + 1] << 8);
      j += 2;
    } else if (longueur === 0x82) {
      longueur = o[j] | (o[j + 1] << 8) | (o[j + 2] << 16) | (o[j + 3] << 24);
      j += 4;
    }
    return texteUtf8(o.slice(j, j + longueur));
  }
  return "";
}

// Date des messages : nanosecondes (ou secondes, anciens macOS) depuis 2001.
function dateIso(valeur) {
  const n = Number(valeur) || 0;
  const secondes = n > 1e12 ? n / 1e9 : n;
  return new Date((secondes + 978307200) * 1000).toISOString();
}

// Point d’entrée appelé par osascript (JXA), hors du module JavaScript.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function run(argv) {
  const entree = argv[0];
  const sortie = argv[1];
  let dernier = Number(argv[2]) || 0;
  let lignes = [];
  try {
    const brut = lire(entree).trim();
    lignes = brut ? JSON.parse(brut) : [];
  } catch {
    lignes = [];
  }
  const reponses = [];
  for (const l of lignes) {
    dernier = Math.max(dernier, Number(l.rowid) || 0);
    const texte = (l.texte && String(l.texte).trim()) || texteDepuisCorps(l.corps_hex);
    if (!texte || !l.guid || !l.tel) continue;
    reponses.push({ guid: String(l.guid), tel: String(l.tel), texte: texte.slice(0, 3000), date: dateIso(l.date) });
  }
  ecrire(sortie, JSON.stringify({ reponses }));
  return String(dernier);
}
