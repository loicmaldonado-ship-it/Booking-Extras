import { cn } from "@/lib/cn";
import type { SelectHTMLAttributes } from "react";

const TONE_CLASSES: Record<string, string> = {
  default: "bg-ink-raised-2 text-text-muted",
  coral: "bg-coral/15 text-coral",
  turquoise: "bg-turquoise/15 text-turquoise",
  yellow: "bg-yellow/15 text-yellow",
  danger: "bg-danger/15 text-danger",
};

// Un <select> stylé comme un badge coloré : édition en ligne fluide, sans
// bouton "Enregistrer" séparé — le changement s'applique au onChange.
export function StatusSelect({
  tone,
  className,
  disabled,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { tone: string }) {
  return (
    <select
      className={cn(
        "cursor-pointer rounded-full border-0 px-3 py-1 text-xs font-medium outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
        TONE_CLASSES[tone] ?? TONE_CLASSES.default,
        className
      )}
      disabled={disabled}
      {...props}
    />
  );
}
