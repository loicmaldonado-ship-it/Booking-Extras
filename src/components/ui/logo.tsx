// Marque du clap + fiche à coches — un plateau de tournage (le clap) posé
// sur une liste de figurant·es cochés (le booking). Le SVG interne est
// écrit en attributs de présentation (fill=, pas de classes Tailwind) pour
// pouvoir être réutilisé tel quel dans les routes ImageResponse (favicon,
// icône PWA, affiche) qui n'ont pas de pipeline CSS.
export const LOGO_GRADIENT_FROM = "#A78BFA";
export const LOGO_GRADIENT_TO = "#5B21B6";
export const LOGO_INK = "#4C1D95";
export const LOGO_LILAC = "#A78BFA";

export function LogoMark({ size = 32, rounded = true }: { size?: number; rounded?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoMarkGrad" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={LOGO_GRADIENT_FROM} />
          <stop offset="1" stopColor={LOGO_GRADIENT_TO} />
        </linearGradient>
        <clipPath id="logoClapClip">
          <rect x="9" y="9" width="36" height="12" rx="2.5" transform="rotate(-9 27 15)" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="64" height="64" rx={rounded ? 15 : 0} fill="url(#logoMarkGrad)" />
      <g clipPath="url(#logoClapClip)">
        <rect x="9" y="9" width="36" height="12" fill="#ffffff" transform="rotate(-9 27 15)" />
        <g transform="rotate(-9 27 15)">
          <rect x="11" y="9" width="4.5" height="12" fill={LOGO_GRADIENT_TO} />
          <rect x="20" y="9" width="4.5" height="12" fill={LOGO_GRADIENT_TO} />
          <rect x="29" y="9" width="4.5" height="12" fill={LOGO_GRADIENT_TO} />
          <rect x="38" y="9" width="4.5" height="12" fill={LOGO_GRADIENT_TO} />
        </g>
      </g>
      <rect x="12" y="25" width="40" height="28" rx="4.5" fill="#ffffff" />
      <g>
        <circle cx="19.5" cy="32.5" r="1.9" fill={LOGO_GRADIENT_TO} />
        <path d="M15.8 37.2 a3.7 3.2 0 0 1 7.4 0 Z" fill={LOGO_GRADIENT_TO} />
        <rect x="26.5" y="31.5" width="14" height="2" rx="1" fill="#DDD6FE" />
        <path
          d="M44.5 32.4 L46.6 34.5 L49.5 30.5"
          stroke={LOGO_GRADIENT_TO}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g>
        <circle cx="19.5" cy="39.5" r="1.9" fill={LOGO_GRADIENT_TO} />
        <path d="M15.8 44.2 a3.7 3.2 0 0 1 7.4 0 Z" fill={LOGO_GRADIENT_TO} />
        <rect x="26.5" y="38.5" width="14" height="2" rx="1" fill="#DDD6FE" />
        <path
          d="M44.5 39.4 L46.6 41.5 L49.5 37.5"
          stroke={LOGO_GRADIENT_TO}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g>
        <circle cx="19.5" cy="46.5" r="1.9" fill={LOGO_GRADIENT_TO} />
        <path d="M15.8 51.2 a3.7 3.2 0 0 1 7.4 0 Z" fill={LOGO_GRADIENT_TO} />
        <rect x="26.5" y="45.5" width="14" height="2" rx="1" fill="#DDD6FE" />
        <path
          d="M44.5 46.4 L46.6 48.5 L49.5 44.5"
          stroke={LOGO_GRADIENT_TO}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function Logo({
  iconSize = 32,
  showText = true,
  stacked = true,
  textClassName = "",
  hideTextOnMobile = false,
}: {
  iconSize?: number;
  showText?: boolean;
  stacked?: boolean;
  textClassName?: string;
  // Cache le wordmark sous 640px (utile dans le bandeau, déjà chargé en
  // boutons sur les pages avec fil d'Ariane + sélecteur de projet) — l'icône
  // seule suffit à identifier la marque sur mobile.
  hideTextOnMobile?: boolean;
}) {
  const textDisplay = hideTextOnMobile ? "hidden sm:flex" : "flex";
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={iconSize} />
      {showText &&
        (stacked ? (
          <span className={`font-display ${textDisplay} flex-col leading-none ${textClassName}`}>
            <span className="font-bold tracking-tight" style={{ color: LOGO_INK }}>
              BOOKING
            </span>
            <span className="mt-1 text-[0.55em] font-semibold tracking-[0.25em]" style={{ color: LOGO_LILAC }}>
              EXTRAS
            </span>
          </span>
        ) : (
          <span className={`font-display ${textDisplay} font-semibold tracking-tight ${textClassName}`}>
            <span style={{ color: LOGO_INK }}>Booking</span>
            <span style={{ color: LOGO_LILAC }}>Extras</span>
          </span>
        ))}
    </span>
  );
}
