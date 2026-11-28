// QA-08 (30/10/2026) : suivi minimal des erreurs, sans service externe ni coût. Chaque erreur serveur (instrumentation.ts)
// ou navigateur (instrumentation-client.ts → /api/erreurs-client) produit UNE ligne JSON préfixée « [booking-error] »
// dans les journaux de la plateforme (Vercel → Logs), filtrable par ce préfixe.
// Confidentialité : aucune donnée de requête (corps, cookies, en-têtes) ; chemin sans paramètres et tokens masqués ;
// emails, téléphones, jetons, mots de passe et identifiants masqués dans le message et la pile. Module sans dépendance
// (utilisable côté serveur et navigateur).

export const PREFIXE_JOURNAL = "[booking-error]";

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

// Chemin sans query ni fragment ; identifiants et tokens remplacés (les liens publics contiennent un token dans le chemin).
export function nettoyerChemin(chemin: unknown): string {
  const brut = typeof chemin === "string" ? chemin : "";
  const sansQuery = brut.split(/[?#]/)[0].slice(0, 300);
  return sansQuery
    .split("/")
    .map((s) => (UUID.test(s) || /^[A-Za-z0-9_-]{20,}$/.test(s) ? ((UUID.lastIndex = 0), ":id") : ((UUID.lastIndex = 0), s)))
    .join("/") || "/";
}

export function nettoyerTexte(texte: unknown, max = 500): string {
  let s = typeof texte === "string" ? texte : texte == null ? "" : String(texte);
  s = s
    .replace(/(pass(word)?|mot[_ -]?de[_ -]?passe|secret|token|api[_-]?key|authorization|cookie|smtp[_a-z]*)(["']?\s*[:=]\s*["']?)[^\s"',;&}]+/gi, "$1$3<masqué>")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer <masqué>")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g, "<jwt>")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<email>")
    .replace(UUID, "<id>")
    .replace(/(?:\+33\s?|\b0)[1-9](?:[\s.-]?\d{2}){4}\b/g, "<tél>")
    .replace(/(?<![\w./-])[A-Za-z0-9+_-]{32,}={0,2}(?![\w./-])/g, "<jeton>")
    .replace(/[?&][^\s?&#=]+=[^\s&#)]*/g, (m) => m.replace(/=.*/, "=<masqué>"));
  return s.length > max ? s.slice(0, max) + "…" : s;
}

// Famille de navigateur seulement (pas l'agent complet, qui sert d'empreinte).
export function familleNavigateur(ua: unknown): string {
  const s = typeof ua === "string" ? ua : "";
  const os = /iPhone|iPad/.test(s) ? "iOS" : /Android/.test(s) ? "Android" : /Mac OS X/.test(s) ? "macOS" : /Windows/.test(s) ? "Windows" : /Linux/.test(s) ? "Linux" : "?";
  const nav = /Edg\//.test(s) ? "Edge" : /Firefox\//.test(s) ? "Firefox" : /Chrome\//.test(s) ? "Chrome" : /Safari\//.test(s) ? "Safari" : "?";
  return `${nav}/${os}`;
}

export type RapportErreur = {
  source: "serveur" | "navigateur";
  env: string;
  release: string;
  route: string;
  routePath?: string;
  routeType?: string;
  methode?: string;
  digest?: string;
  type: string;
  message: string;
  pile: string;
  navigateur?: string;
  date: string;
};

export function construireRapport(input: {
  source: RapportErreur["source"];
  erreur: unknown;
  chemin?: unknown;
  routePath?: unknown;
  routeType?: unknown;
  methode?: unknown;
  userAgent?: unknown;
  pile?: unknown;
  type?: unknown;
  message?: unknown;
}): RapportErreur {
  const e = input.erreur as { name?: unknown; message?: unknown; stack?: unknown; digest?: unknown } | null | undefined;
  const env = (typeof process !== "undefined" && (process.env.VERCEL_ENV || process.env.NODE_ENV)) || "inconnu";
  const release = (typeof process !== "undefined" && (process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_RELEASE)) || "local";
  return {
    source: input.source,
    env,
    release: String(release).slice(0, 12),
    route: nettoyerChemin(input.chemin),
    routePath: typeof input.routePath === "string" ? input.routePath.slice(0, 200) : undefined,
    routeType: typeof input.routeType === "string" ? input.routeType.slice(0, 40) : undefined,
    methode: typeof input.methode === "string" ? input.methode.slice(0, 10) : undefined,
    digest: e && typeof e === "object" && e.digest != null ? String(e.digest).slice(0, 40) : undefined,
    type: nettoyerTexte(input.type ?? (e && typeof e === "object" ? e.name : undefined) ?? "Error", 60),
    message: nettoyerTexte(input.message ?? (e && typeof e === "object" ? e.message : e)),
    pile: nettoyerTexte(input.pile ?? (e && typeof e === "object" ? e.stack : ""), 3000),
    navigateur: input.userAgent ? familleNavigateur(input.userAgent) : undefined,
    date: new Date().toISOString(),
  };
}

export function ecrireRapport(rapport: RapportErreur): void {
  console.error(`${PREFIXE_JOURNAL} ${JSON.stringify(rapport)}`);
}
