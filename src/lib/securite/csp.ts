// Politique de sécurité du contenu complète (audit du 31/10/2026) : construite à chaque requête par le middleware avec
// un nonce aléatoire. Next.js lit le nonce dans l'en-tête de la requête et l'ajoute à ses propres scripts ; un script
// injecté dans une page (XSS) n'a pas le nonce et ne s'exécute pas. Toutes les pages HTML sont rendues à la demande.

export function origineSupabase(url: string | undefined): { http: string; ws: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return { http: u.origin, ws: `${u.protocol === "https:" ? "wss:" : "ws:"}//${u.host}` };
  } catch {
    return null;
  }
}

export function nouveauNonce(): string {
  const octets = new Uint8Array(16);
  crypto.getRandomValues(octets);
  return btoa(String.fromCharCode(...octets));
}

export function politiqueContenu(opts: { nonce: string; supabaseUrl?: string; dev: boolean; https: boolean }): string {
  const supa = origineSupabase(opts.supabaseUrl);
  const s = supa ? ` ${supa.http}` : "";
  const directives = [
    "default-src 'self'",
    // 'strict-dynamic' : les scripts chargés par un script de confiance (morceaux de Next) sont admis ;
    // 'wasm-unsafe-eval' : conversion des photos HEIC d'iPhone (WebAssembly, sans eval de texte).
    `script-src 'self' 'nonce-${opts.nonce}' 'strict-dynamic' 'wasm-unsafe-eval'${opts.dev ? " 'unsafe-eval'" : ""}`,
    // Attributs style="" de React : 'unsafe-inline' limité aux styles (aucune exécution de code).
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data:${s}`,
    `media-src 'self' blob:${s}`,
    "font-src 'self' data:",
    `connect-src 'self'${s}${supa ? ` ${supa.ws}` : ""}`,
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(opts.https ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}
