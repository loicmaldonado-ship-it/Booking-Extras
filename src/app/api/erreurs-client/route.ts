import { construireRapport, ecrireRapport } from "@/lib/observabilite/rapport-erreur";

// QA-08 : réception des erreurs navigateur (instrumentation-client.ts). Public par nature (une erreur peut survenir
// avant connexion) : corps limité à 8 Ko, contenu re-nettoyé ici, rien n'est stocké en base ; réponse toujours 204.
const MAX_OCTETS = 8 * 1024;

export async function POST(request: Request) {
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
