import { construireRapport, ecrireRapport } from "@/lib/observabilite/rapport-erreur";

// QA-08 : réception des erreurs navigateur (instrumentation-client.ts). Public par nature (une erreur peut survenir
// avant connexion) : corps limité à 8 Ko, contenu re-nettoyé ici, rien n'est stocké en base ; réponse toujours 204.
const MAX_OCTETS = 8 * 1024;
// Limite de débit simple par adresse (par instance) : 20 signalements par minute, au-delà ignorés (réponse identique).
const FENETRE_MS = 60_000, MAX_PAR_FENETRE = 20;
const compteurs = new Map<string, { debut: number; n: number }>();
function autorise(cle: string): boolean {
  const maintenant = Date.now();
  if (compteurs.size > 5000) compteurs.clear();
  const c = compteurs.get(cle);
  if (!c || maintenant - c.debut > FENETRE_MS) { compteurs.set(cle, { debut: maintenant, n: 1 }); return true; }
  c.n += 1;
  return c.n <= MAX_PAR_FENETRE;
}

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnue";
  if (!autorise(ip)) return new Response(null, { status: 204 });
  try {
    const texte = await request.text();
    if (texte.length > MAX_OCTETS) return new Response(null, { status: 204 });
    const donnees = JSON.parse(texte) as Record<string, unknown>;
    if (!donnees || typeof donnees !== "object") return new Response(null, { status: 204 });
    ecrireRapport(
      construireRapport({
        source: "navigateur",
        erreur: null,
        type: donnees.type,
        message: donnees.message,
        pile: donnees.pile,
        chemin: donnees.route,
        userAgent: request.headers.get("user-agent"),
      })
    );
  } catch {
    // corps invalide : ignoré
  }
  return new Response(null, { status: 204 });
}
