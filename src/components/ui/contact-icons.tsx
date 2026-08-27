"use client";

import { cn } from "@/lib/cn";

// Trois raccourcis contact (appel/texto/email), pensés pour être posés sur
// n'importe quelle carte ou ligne de profil — indépendants du rôle/contexte
// (contrairement aux boutons "Rappel" du covoiturage qui envoient un
// message pré-rempli). "card" = ligne pleine largeur sous une photo,
// "inline" = trio compact pour une ligne de tableau dense.
export function ContactIcons({
  telephone,
  email,
  variant = "card",
  className,
}: {
  telephone?: string | null;
  email?: string | null;
  variant?: "card" | "inline";
  className?: string;
}) {
  if (!telephone && !email) return null;
  const tel = telephone ?? undefined;

  const iconClass = cn(
    "flex items-center justify-center rounded-md border border-border text-text-muted hover:border-coral/60 hover:text-text",
    variant === "card" ? "h-6 flex-1 text-xs" : "h-5 w-5 shrink-0 text-[10px]"
  );

  return (
    <div
      className={cn(variant === "card" ? "flex w-full gap-1" : "inline-flex gap-1", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {tel && (
        <a href={`tel:${tel.replace(/\s+/g, "")}`} className={iconClass} title="Appeler" draggable={false}>
          📞
        </a>
      )}
      {tel && (
        <a
          href={`sms:${encodeURIComponent(tel.replace(/\s+/g, ""))}`}
          className={iconClass}
          title="Texto"
          draggable={false}
        >
          💬
        </a>
      )}
      {email && (
        <a href={`mailto:${email}`} className={iconClass} title="Email" draggable={false}>
          ✉️
        </a>
      )}
    </div>
  );
}
