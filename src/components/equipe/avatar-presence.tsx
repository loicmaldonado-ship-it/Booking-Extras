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
}: {
  avatarUrl: string | null;
  nom: string | null;
  email: string | null;
  online: boolean;
  size?: number;
}) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {avatarUrl ? (
        <Image src={avatarUrl} alt="" fill className="rounded-full object-cover" unoptimized />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-ink-raised-2 text-xs font-semibold text-text-muted">
          {initials(nom, email)}
        </div>
      )}
      {online && (
        <span
          className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-ink-raised bg-turquoise"
          title="Connecté·e"
        />
      )}
    </div>
  );
}
