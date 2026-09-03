import Image from "next/image";

function initials(nom: string | null, email: string | null): string {
  const label = (nom || email || "?").trim();
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

export function AvatarPresence({
  avatarUrl,
  nom,
  email,
  online,
  size = 40,
  // "dot-when-online" (défaut) : pastille verte seulement si connecté·e,
  // rien sinon — utilisé sur Équipe/Admin et le menu "ma photo" (où on ne
  // veut pas indiquer de statut du tout pour l'avatar de soi-même).
  // "dot-always" : pastille verte OU rouge, pour un bandeau où l'absence de
  // pastille serait ambiguë (connecté ? pas encore chargé ?).
  variant = "dot-when-online",
  // true quand avatarUrl est un aperçu local (blob: avant envoi du
  // formulaire) plutôt qu'une URL du stockage — l'optimiseur d'images de
  // Next ne sait pas traiter un blob:, donc on le court-circuite.
  previewIsLocal = false,
}: {
  avatarUrl: string | null;
  nom: string | null;
  email: string | null;
  online: boolean;
  size?: number;
  variant?: "dot-when-online" | "dot-always";
  previewIsLocal?: boolean;
}) {
  const showDot = variant === "dot-always" || online;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {avatarUrl ? (
        <Image src={avatarUrl} alt="" fill className="rounded-full object-cover" unoptimized={previewIsLocal} />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-ink-raised-2 text-xs font-semibold text-text-muted">
          {initials(nom, email)}
        </div>
      )}
      {showDot && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-ink-raised ${online ? "bg-turquoise" : "bg-danger"}`}
          title={online ? "Connecté·e" : "Hors ligne"}
        />
      )}
    </div>
  );
}
